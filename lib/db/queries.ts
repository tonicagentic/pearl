import { randomUUID } from "node:crypto";
import { isBinaryWorkspacePath } from "@/agent/lib/design-files";
import {
  readPrivateBlobText,
  signedPrivateBlobGetUrl,
} from "@/lib/blob/private";
import { and, asc, desc, eq, gte, inArray, isNull, lt, or, sql } from "drizzle-orm";
import type { ClientSessionState, SessionStreamEvent } from "eve/client";
import {
  chatPresence,
  isChatTurnSettledEvent,
  type ChatPresence,
} from "@/lib/chat/events";
import type {
  ActiveChat,
  ChatListItem,
  ChatListPage,
  ChatSearchHit,
} from "@/lib/chat/types";
import {
  spokenTurnsFromRow,
  type SpokenTurn,
} from "@/lib/chat/spoken-turns";
import { createFallbackTitle, DEFAULT_CHAT_TITLE } from "@/lib/chat/title";
import {
  chat,
  chatEvent,
  customAgent,
  agentFile,
  agentFileRevision,
  agentAttachment,
} from "@/lib/db/schema";
import { db } from "@/lib/db/client";
import {
  isAgentMarkShape,
  isAgentMarkTalk,
} from "@/lib/custom-agents/mark";
import type { CustomAgentRef } from "@/lib/custom-agents/types";

const CHAT_HISTORY_PAGE_SIZE = 20;
const CHAT_SEARCH_LIMIT = 40;

function escapeIlikePattern(input: string): string {
  return input.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

function makeSearchSnippet(haystack: string, query: string, max = 88): string {
  const cleaned = haystack
    .replace(/\\[ntr]/g, " ")
    .replace(/[{}\[\]"\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "";
  const lower = cleaned.toLowerCase();
  const q = query.toLowerCase();
  const idx = lower.indexOf(q);
  if (idx < 0) {
    return cleaned.length > max ? `${cleaned.slice(0, max - 1).trimEnd()}…` : cleaned;
  }
  const start = Math.max(0, idx - 24);
  const end = Math.min(cleaned.length, idx + q.length + 48);
  let snippet = cleaned.slice(start, end).trim();
  if (start > 0) snippet = `…${snippet}`;
  if (end < cleaned.length) snippet = `${snippet}…`;
  return snippet.length > max ? `${snippet.slice(0, max - 1).trimEnd()}…` : snippet;
}

function encodeChatCursor(updatedAt: Date, id: string) {
  return `${updatedAt.toISOString()}::${id}`;
}

function decodeChatCursor(cursor: string) {
  const [updatedAtRaw, id] = cursor.split("::");

  if (!updatedAtRaw || !id) {
    return null;
  }

  const updatedAt = new Date(updatedAtRaw);

  if (Number.isNaN(updatedAt.getTime())) {
    return null;
  }

  return { id, updatedAt };
}

export async function listChatsByUser(userId: string): Promise<ChatListItem[]> {
  const page = await listChatsPageByUser(userId);

  return [...page.items];
}

export async function listChatsPageByUser(
  userId: string,
  cursor?: string | null,
): Promise<ChatListPage> {
  const cursorValue = cursor?.trim();
  const parsedCursor = cursorValue ? decodeChatCursor(cursorValue) : null;
  const rows = await db
    .select({
      id: chat.id,
      title: chat.title,
      updatedAt: chat.updatedAt,
      projectId: chat.projectId,
      remoteAgentId: chat.remoteAgentId,
      lastReadAt: chat.lastReadAt,
    })
    .from(chat)
    .where(
      and(
        eq(chat.userId, userId),
        // Custom-agent threads live under Agents, not the chat history list.
        isNull(chat.customAgentId),
        parsedCursor
          ? or(
              lt(chat.updatedAt, parsedCursor.updatedAt),
              and(eq(chat.updatedAt, parsedCursor.updatedAt), lt(chat.id, parsedCursor.id)),
            )
          : undefined,
      ),
    )
    .orderBy(desc(chat.updatedAt), desc(chat.id))
    .limit(CHAT_HISTORY_PAGE_SIZE + 1);

  const hasMore = rows.length > CHAT_HISTORY_PAGE_SIZE;
  const pageRows = hasMore ? rows.slice(0, CHAT_HISTORY_PAGE_SIZE) : rows;
  const last = pageRows[pageRows.length - 1];
  const presenceByChatId = await presenceByChatIds(
    pageRows.map((row) => ({
      id: row.id,
      lastReadAt: row.lastReadAt,
    })),
  );

  return {
    items: pageRows.map((row) => {
      const presence = presenceByChatId.get(row.id) ?? "idle";
      return {
        id: row.id,
        title: row.title,
        updatedAt: row.updatedAt.toISOString(),
        projectId: row.projectId ?? null,
        remoteAgentId: row.remoteAgentId ?? null,
        waitingForInput: presence === "waiting",
        presence,
      };
    }),
    nextCursor: hasMore && last ? encodeChatCursor(last.updatedAt, last.id) : null,
  };
}

type PresenceChatRef = {
  readonly id: string;
  readonly lastReadAt: Date | null;
};

/** Batch-compute home-list presence from durable event logs. */
async function presenceByChatIds(
  chats: readonly PresenceChatRef[],
): Promise<Map<string, ChatPresence>> {
  const presence = new Map<string, ChatPresence>();
  for (const item of chats) presence.set(item.id, "idle");
  if (chats.length === 0) return presence;

  const chatIds = chats.map((item) => item.id);
  const lastReadById = new Map(
    chats.map((item) => [item.id, item.lastReadAt] as const),
  );

  const rows = await db
    .select({
      chatId: chatEvent.chatId,
      event: chatEvent.event,
      eventIndex: chatEvent.eventIndex,
      createdAt: chatEvent.createdAt,
    })
    .from(chatEvent)
    .where(
      and(
        inArray(chatEvent.chatId, [...chatIds]),
        sql`${chatEvent.event} ->> 'type' in (
          'interaction.opened',
          'interaction.settled',
          'turn.started',
          'turn.paused',
          'turn.settled',
          'delivery.consumed',
          'session.ended'
        )`,
      ),
    )
    .orderBy(asc(chatEvent.chatId), asc(chatEvent.eventIndex));

  const eventsByChat = new Map<string, SessionStreamEvent[]>();
  const timesByChat = new Map<string, Date[]>();
  for (const row of rows) {
    const list = eventsByChat.get(row.chatId) ?? [];
    list.push(row.event);
    eventsByChat.set(row.chatId, list);
    const times = timesByChat.get(row.chatId) ?? [];
    times.push(row.createdAt);
    timesByChat.set(row.chatId, times);
  }

  for (const id of chatIds) {
    const events = eventsByChat.get(id) ?? [];
    presence.set(
      id,
      chatPresence(events, {
        lastReadAt: lastReadById.get(id) ?? null,
        eventTimes: timesByChat.get(id),
      }),
    );
  }

  return presence;
}

/**
 * Absolute app-icon badge: how many of the user's chats are parked on
 * presence "waiting" (needs you). Not unread / working.
 */
export async function countWaitingChatsForUser(
  userId: string,
): Promise<number> {
  const rows = await db
    .select({ id: chat.id, lastReadAt: chat.lastReadAt })
    .from(chat)
    .where(eq(chat.userId, userId));

  if (rows.length === 0) {
    return 0;
  }

  const presenceById = await presenceByChatIds(
    rows.map((row) => ({ id: row.id, lastReadAt: row.lastReadAt })),
  );

  let waiting = 0;
  for (const presence of presenceById.values()) {
    if (presence === "waiting") waiting += 1;
  }
  return waiting;
}

export async function createChat(
  userId: string,
  {
    pendingUserMessage,
    projectId,
  }: {
    readonly pendingUserMessage?: string;
    readonly projectId?: string | null;
  } = {},
) {
  const pendingMessage = pendingUserMessage?.trim();
  const pendingMessageCreatedAt = pendingMessage ? new Date() : null;
  const [row] = await db
    .insert(chat)
    .values({
      id: randomUUID(),
      pendingUserMessage: pendingMessage || null,
      pendingUserMessageCreatedAt: pendingMessageCreatedAt,
      title: pendingMessage ? createFallbackTitle(pendingMessage) : DEFAULT_CHAT_TITLE,
      userId,
      projectId: projectId ?? null,
    })
    .returning({
      id: chat.id,
      title: chat.title,
      updatedAt: chat.updatedAt,
      projectId: chat.projectId,
      remoteAgentId: chat.remoteAgentId,
    });

  if (!row) {
    throw new Error("Failed to create chat.");
  }

  return {
    id: row.id,
    title: row.title,
    updatedAt: row.updatedAt.toISOString(),
    projectId: row.projectId ?? null,
    remoteAgentId: row.remoteAgentId ?? null,
    waitingForInput: false,
    presence: "idle" as const,
  };
}

/** Stamp the chat as read so home-list unread clears. */
export async function markChatRead({
  chatId,
  userId,
  readAt = new Date(),
}: {
  readonly chatId: string;
  readonly userId: string;
  readonly readAt?: Date;
}): Promise<{ readonly lastReadAt: string } | null> {
  const [row] = await db
    .update(chat)
    .set({ lastReadAt: readAt })
    .where(and(eq(chat.id, chatId), eq(chat.userId, userId)))
    .returning({ lastReadAt: chat.lastReadAt });

  if (!row) return null;
  return { lastReadAt: row.lastReadAt.toISOString() };
}

export async function getChatForUser(chatId: string, userId: string): Promise<ActiveChat | null> {
  const [row] = await db
    .select({
      id: chat.id,
      title: chat.title,
      eveSession: chat.eveSession,
      pendingUserMessage: chat.pendingUserMessage,
      pendingUserMessageCreatedAt: chat.pendingUserMessageCreatedAt,
      projectId: chat.projectId,
      remoteAgentId: chat.remoteAgentId,
      spokenTurns: chat.spokenTurns,
      customAgentId: customAgent.id,
      customAgentName: customAgent.name,
      customAgentAccent: customAgent.accent,
      customAgentMarkShape: customAgent.markShape,
      customAgentMarkTalk: customAgent.markTalk,
      customAgentInstructions: customAgent.instructions,
    })
    .from(chat)
    .leftJoin(customAgent, eq(customAgent.id, chat.customAgentId))
    .where(and(eq(chat.id, chatId), eq(chat.userId, userId)))
    .limit(1);

  if (!row) {
    return null;
  }

  const events = await db
    .select({
      createdAt: chatEvent.createdAt,
      event: chatEvent.event,
    })
    .from(chatEvent)
    .where(eq(chatEvent.chatId, chatId))
    .orderBy(asc(chatEvent.eventIndex));

  const eventValues = events.map((eventRow) => eventRow.event);
  const pendingMessageCreatedAt = row.pendingUserMessageCreatedAt;
  const hasCurrentTurnCompleted = Boolean(
    pendingMessageCreatedAt &&
    events.some(
      (eventRow) =>
        eventRow.createdAt >= pendingMessageCreatedAt &&
        isChatTurnSettledEvent(eventRow.event),
    ),
  );

  const customAgentRef: CustomAgentRef | null =
    row.customAgentId && row.customAgentName && row.customAgentAccent
      ? {
          id: row.customAgentId,
          name: row.customAgentName,
          accent: row.customAgentAccent,
          markShape: isAgentMarkShape(row.customAgentMarkShape)
            ? row.customAgentMarkShape
            : "oval",
          markTalk: isAgentMarkTalk(row.customAgentMarkTalk)
            ? row.customAgentMarkTalk
            : "hinge",
          instructions: row.customAgentInstructions ?? "",
        }
      : null;

  return {
    events: eventValues,
    id: row.id,
    pendingUserMessage: hasCurrentTurnCompleted ? null : row.pendingUserMessage,
    projectId: row.projectId ?? null,
    remoteAgentId: row.remoteAgentId ?? null,
    customAgent: customAgentRef,
    session: row.eveSession ?? undefined,
    spokenTurns: Array.isArray(row.spokenTurns) ? row.spokenTurns : [],
    title: row.title,
  };
}

/** Persist live voice turns on the chat until the next real send imports them. */
export async function saveSpokenTurnsForUser({
  chatId,
  userId,
  turns,
}: {
  readonly chatId: string;
  readonly userId: string;
  readonly turns: readonly SpokenTurn[];
}): Promise<boolean> {
  const [row] = await db
    .update(chat)
    .set({
      spokenTurns: [...turns],
      title: sql<string>`
        case
          when ${chat.title} = ${DEFAULT_CHAT_TITLE}
          then ${createFallbackTitle(turns.find((turn) => turn.role === "user")?.text ?? "Live conversation")}
          else ${chat.title}
        end
      `,
      updatedAt: new Date(),
    })
    .where(and(eq(chat.id, chatId), eq(chat.userId, userId)))
    .returning({ id: chat.id });

  return Boolean(row);
}

/**
 * Read and clear spoken turns for a chat the caller owns.
 * Used by the eve channel to import history on the next real send.
 *
 * No transaction: the neon-http driver (production) does not support them
 * ("No transactions support in neon-http driver"). Select then clear as
 * sequential statements — overlapping sends are already blocked client-side,
 * and a failure between the two leaves turns for the next send to import.
 */
export async function takeSpokenTurnsForUser({
  chatId,
  userId,
}: {
  readonly chatId: string;
  readonly userId: string;
}): Promise<SpokenTurn[]> {
  const [row] = await db
    .select({ spokenTurns: chat.spokenTurns })
    .from(chat)
    .where(and(eq(chat.id, chatId), eq(chat.userId, userId)))
    .limit(1);

  const turns = spokenTurnsFromRow(row);
  if (turns.length === 0) return [];

  await db
    .update(chat)
    .set({ spokenTurns: [], updatedAt: new Date() })
    .where(and(eq(chat.id, chatId), eq(chat.userId, userId)));

  return turns;
}

/**
 * Resolve which chat holds spoken turns for this delivery: prefer an explicit
 * chat id from clientContext, then the chat linked to the eve session.
 */
export async function resolveChatIdForSpokenTurns({
  chatId,
  sessionId,
  userId,
}: {
  readonly chatId?: string | null;
  readonly sessionId?: string | null;
  readonly userId: string;
}): Promise<string | null> {
  const explicit = chatId?.trim();
  if (explicit) {
    const [row] = await db
      .select({ id: chat.id })
      .from(chat)
      .where(and(eq(chat.id, explicit), eq(chat.userId, userId)))
      .limit(1);
    if (row) return row.id;
  }

  const fromSession = sessionId?.trim();
  if (!fromSession) return null;
  const linked = await getChatIdByEveSessionId(fromSession);
  if (!linked) return null;
  const [owned] = await db
    .select({ id: chat.id })
    .from(chat)
    .where(and(eq(chat.id, linked), eq(chat.userId, userId)))
    .limit(1);
  return owned?.id ?? null;
}

export async function markChatPendingMessage({
  chatId,
  message,
  userId,
}: {
  readonly chatId: string;
  readonly message: string;
  readonly userId: string;
}) {
  const pendingMessage = message.trim();

  if (!pendingMessage) {
    throw new Error("Message cannot be empty.");
  }

  const [row] = await db
    .update(chat)
    .set({
      pendingUserMessage: pendingMessage,
      pendingUserMessageCreatedAt: new Date(),
      title: sql<string>`
        case
          when ${chat.title} = ${DEFAULT_CHAT_TITLE}
          then ${createFallbackTitle(pendingMessage)}
          else ${chat.title}
        end
      `,
      updatedAt: new Date(),
    })
    .where(and(eq(chat.id, chatId), eq(chat.userId, userId)))
    .returning({
      id: chat.id,
      title: chat.title,
      updatedAt: chat.updatedAt,
    });

  if (!row) {
    throw new Error("Chat not found.");
  }

  return {
    id: row.id,
    title: row.title,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function clearChatPendingMessage({
  chatId,
  userId,
}: {
  readonly chatId: string;
  readonly userId: string;
}) {
  await db
    .update(chat)
    .set({
      pendingUserMessage: null,
      pendingUserMessageCreatedAt: null,
    })
    .where(and(eq(chat.id, chatId), eq(chat.userId, userId)));
}

export async function skipChatAuthorization({
  chatId,
  events,
  session,
  userId,
}: {
  readonly chatId: string;
  readonly events: readonly SessionStreamEvent[];
  readonly session: ClientSessionState | undefined;
  readonly userId: string;
}) {
  if (events.length === 0) {
    throw new Error("No authorization events to save.");
  }

  const [ownedChat] = await db
    .select({ id: chat.id })
    .from(chat)
    .where(and(eq(chat.id, chatId), eq(chat.userId, userId)))
    .limit(1);

  if (!ownedChat) {
    throw new Error("Chat not found.");
  }

  const [lastEvent] = await db
    .select({ eventIndex: chatEvent.eventIndex })
    .from(chatEvent)
    .where(eq(chatEvent.chatId, chatId))
    .orderBy(desc(chatEvent.eventIndex))
    .limit(1);
  const eventIndex = (lastEvent?.eventIndex ?? -1) + 1;

  await db
    .insert(chatEvent)
    .values(
      events.map((event, offset) => ({
        chatId,
        event,
        eventIndex: eventIndex + offset,
        id: randomUUID(),
      })),
    )
    .onConflictDoUpdate({
      set: { event: sql`excluded.event` },
      target: [chatEvent.chatId, chatEvent.eventIndex],
    });

  const [row] = await db
    .update(chat)
    .set({
      eveSession: session ?? null,
      pendingUserMessage: null,
      pendingUserMessageCreatedAt: null,
      updatedAt: new Date(),
    })
    .where(and(eq(chat.id, chatId), eq(chat.userId, userId)))
    .returning({
      id: chat.id,
      title: chat.title,
      updatedAt: chat.updatedAt,
    });

  if (!row) {
    throw new Error("Chat not found.");
  }

  return {
    chat: {
      id: row.id,
      title: row.title,
      updatedAt: row.updatedAt.toISOString(),
    },
    eventCount: events.length,
    eventIndex,
  };
}

export async function saveChatSessionState({
  chatId,
  session,
  userId,
}: {
  readonly chatId: string;
  readonly session: ClientSessionState;
  readonly userId: string;
}) {
  await db
    .update(chat)
    .set({
      eveSession: session,
    })
    .where(and(eq(chat.id, chatId), eq(chat.userId, userId)));
}

export async function appendChatEvent({
  chatId,
  event,
  eventIndex,
  userId,
}: {
  readonly chatId: string;
  readonly event: SessionStreamEvent;
  readonly eventIndex: number;
  readonly userId: string;
}) {
  const [ownedChat] = await db
    .select({ id: chat.id })
    .from(chat)
    .where(and(eq(chat.id, chatId), eq(chat.userId, userId)))
    .limit(1);

  if (!ownedChat) {
    throw new Error("Chat not found.");
  }

  await db
    .insert(chatEvent)
    .values({
      chatId,
      event,
      eventIndex,
      id: randomUUID(),
    })
    .onConflictDoUpdate({
      set: { event },
      target: [chatEvent.chatId, chatEvent.eventIndex],
    });
}

export async function appendChatEvents({
  chatId,
  events,
  userId,
}: {
  readonly chatId: string;
  readonly events: readonly {
    readonly event: SessionStreamEvent;
    readonly eventIndex: number;
  }[];
  readonly userId: string;
}) {
  if (events.length === 0) {
    return;
  }

  const [ownedChat] = await db
    .select({ id: chat.id })
    .from(chat)
    .where(and(eq(chat.id, chatId), eq(chat.userId, userId)))
    .limit(1);

  if (!ownedChat) {
    throw new Error("Chat not found.");
  }

  // One multi-row insert per flush instead of one roundtrip per streamed
  // event (docs: checkpoint-optimization-plan.md). The conflict target keeps
  // the same upsert semantics as the single-event append, so a flush that
  // races a retry stays idempotent per (chat, eventIndex).
  await db
    .insert(chatEvent)
    .values(
      events.map((entry) => ({
        chatId,
        event: entry.event,
        eventIndex: entry.eventIndex,
        id: randomUUID(),
      })),
    )
    .onConflictDoUpdate({
      set: { event: sql`excluded.event` },
      target: [chatEvent.chatId, chatEvent.eventIndex],
    });
}

/** Event types that drive Recents presence (matches presenceByChatIds filter). */
export const CHAT_PRESENCE_EVENT_TYPES = [
  "interaction.opened",
  "interaction.settled",
  "turn.started",
  "turn.paused",
  "turn.settled",
  "delivery.consumed",
  "session.ended",
] as const;

export type ChatPresenceEventType = (typeof CHAT_PRESENCE_EVENT_TYPES)[number];

export function isChatPresenceEventType(
  type: string,
): type is ChatPresenceEventType {
  return (CHAT_PRESENCE_EVENT_TYPES as readonly string[]).includes(type);
}

/**
 * Upsert a presence-relevant stream event from an eve agent hook (no cookie).
 * Idempotent on (chatId, eventIndex) so client flushes can race safely.
 * Returns null when no chat row is linked to the session yet.
 */
export async function appendChatEventForSession({
  sessionId,
  event,
  eventIndex,
  bumpUpdatedAt = true,
}: {
  readonly sessionId: string;
  readonly event: SessionStreamEvent;
  readonly eventIndex: number;
  readonly bumpUpdatedAt?: boolean;
}): Promise<{
  readonly chatId: string;
  readonly userId: string;
  readonly presence: ChatPresence;
} | null> {
  const [row] = await db
    .select({
      id: chat.id,
      userId: chat.userId,
      lastReadAt: chat.lastReadAt,
    })
    .from(chat)
    .where(sql`${chat.eveSession} ->> 'sessionId' = ${sessionId}`)
    .limit(1);

  if (!row) {
    return null;
  }

  await db
    .insert(chatEvent)
    .values({
      chatId: row.id,
      event,
      eventIndex,
      id: randomUUID(),
    })
    .onConflictDoUpdate({
      set: { event },
      target: [chatEvent.chatId, chatEvent.eventIndex],
    });

  if (bumpUpdatedAt) {
    await db
      .update(chat)
      .set({ updatedAt: new Date() })
      .where(eq(chat.id, row.id));
  }

  const presenceById = await presenceByChatIds([
    { id: row.id, lastReadAt: row.lastReadAt },
  ]);

  return {
    chatId: row.id,
    userId: row.userId,
    presence: presenceById.get(row.id) ?? "idle",
  };
}

export async function saveChatSnapshot({
  chatId,
  events,
  session,
  userId,
}: {
  readonly chatId: string;
  readonly events: readonly SessionStreamEvent[];
  readonly session: ClientSessionState | undefined;
  readonly userId: string;
}) {
  const [ownedChat] = await db
    .select({ id: chat.id })
    .from(chat)
    .where(and(eq(chat.id, chatId), eq(chat.userId, userId)))
    .limit(1);

  if (!ownedChat) {
    throw new Error("Chat not found.");
  }

  const [lastEvent] = await db
    .select({ eventIndex: chatEvent.eventIndex })
    .from(chatEvent)
    .where(eq(chatEvent.chatId, chatId))
    .orderBy(desc(chatEvent.eventIndex))
    .limit(1);
  const previousLength = (lastEvent?.eventIndex ?? -1) + 1;
  // Recents sort by updatedAt. Only bump it when the durable stream grew or
  // shrank — idle open/resume snapshots must not reorder the sidebar.
  const streamChanged = events.length !== previousLength;

  if (events.length > 0) {
    await db
      .insert(chatEvent)
      .values(
        events.map((event, eventIndex) => ({
          chatId,
          event,
          eventIndex,
          id: randomUUID(),
        })),
      )
      .onConflictDoUpdate({
        set: { event: sql`excluded.event` },
        target: [chatEvent.chatId, chatEvent.eventIndex],
      });
  }

  await db
    .delete(chatEvent)
    .where(and(eq(chatEvent.chatId, chatId), gte(chatEvent.eventIndex, events.length)));

  await db
    .update(chat)
    .set({
      eveSession: session ?? null,
      pendingUserMessage: null,
      pendingUserMessageCreatedAt: null,
      ...(streamChanged ? { updatedAt: new Date() } : {}),
    })
    .where(and(eq(chat.id, chatId), eq(chat.userId, userId)));
}

export async function deleteChatForUser(
  chatId: string,
  userId: string,
  options?: {
    readonly requestHeaders?: Headers | HeadersInit;
  },
) {
  const [row] = await db
    .select({
      eveSession: chat.eveSession,
      customAgentId: chat.customAgentId,
    })
    .from(chat)
    .where(and(eq(chat.id, chatId), eq(chat.userId, userId)))
    .limit(1);

  const sessionId = row?.eveSession?.sessionId;
  if (sessionId) {
    const { bestEffortEndEveSession } = await import("@/lib/eve/end-session");
    await bestEffortEndEveSession({
      sessionId,
      requestHeaders: options?.requestHeaders,
      reason: "chat_deleted",
    });
  }

  // Custom-agent threads own the agent: deleting the chat removes the agent
  // (and cascade removes the chat). Normal chats delete the row only.
  if (row?.customAgentId) {
    await db
      .delete(customAgent)
      .where(
        and(
          eq(customAgent.id, row.customAgentId),
          eq(customAgent.userId, userId),
        ),
      );
    return;
  }

  await db.delete(chat).where(and(eq(chat.id, chatId), eq(chat.userId, userId)));
}

/**
 * Search all of a user's chats by title or durable event text.
 * Returns newest matches first (deduped), with an optional snippet.
 */
export async function searchChatsForUser(
  userId: string,
  query: string,
): Promise<readonly ChatSearchHit[]> {
  const trimmed = query.replace(/\s+/g, " ").trim();
  if (!trimmed) return [];

  const pattern = `%${escapeIlikePattern(trimmed)}%`;

  const rows = await db
    .select({
      id: chat.id,
      title: chat.title,
      updatedAt: chat.updatedAt,
      projectId: chat.projectId,
      lastReadAt: chat.lastReadAt,
      eventText: sql<string | null>`${chatEvent.event}::text`,
      titleMatched: sql<boolean>`${chat.title} ilike ${pattern} escape '\\'`,
    })
    .from(chat)
    .leftJoin(
      chatEvent,
      and(
        eq(chatEvent.chatId, chat.id),
        sql`${chatEvent.event}::text ilike ${pattern} escape '\\'`,
      ),
    )
    .where(
      and(
        eq(chat.userId, userId),
        isNull(chat.customAgentId),
        or(
          sql`${chat.title} ilike ${pattern} escape '\\'`,
          sql`${chatEvent.event}::text ilike ${pattern} escape '\\'`,
        ),
      ),
    )
    .orderBy(desc(chat.updatedAt), desc(chat.id))
    .limit(CHAT_SEARCH_LIMIT * 4);

  const byId = new Map<
    string,
    {
      id: string;
      title: string;
      updatedAt: Date;
      projectId: string | null;
      lastReadAt: Date | null;
      titleMatched: boolean;
      eventText: string | null;
    }
  >();

  for (const row of rows) {
    const existing = byId.get(row.id);
    if (existing) {
      if (!existing.eventText && row.eventText) {
        existing.eventText = row.eventText;
      }
      continue;
    }
    byId.set(row.id, {
      id: row.id,
      title: row.title,
      updatedAt: row.updatedAt,
      projectId: row.projectId ?? null,
      lastReadAt: row.lastReadAt,
      titleMatched: Boolean(row.titleMatched),
      eventText: row.eventText,
    });
    if (byId.size >= CHAT_SEARCH_LIMIT) break;
  }

  const page = [...byId.values()];
  const presenceByChatId = await presenceByChatIds(
    page.map((row) => ({ id: row.id, lastReadAt: row.lastReadAt })),
  );

  return page.map((row) => {
    const snippet =
      row.titleMatched || !row.eventText
        ? null
        : makeSearchSnippet(row.eventText, trimmed) || null;
    const presence = presenceByChatId.get(row.id) ?? "idle";
    return {
      id: row.id,
      title: row.title,
      updatedAt: row.updatedAt.toISOString(),
      projectId: row.projectId,
      waitingForInput: presence === "waiting",
      presence,
      snippet,
    };
  });
}

/** Rename a chat the viewer owns. Empty titles are rejected. */
export async function updateChatTitleForUser(
  chatId: string,
  userId: string,
  title: string,
): Promise<{ readonly id: string; readonly title: string; readonly updatedAt: string } | null> {
  const nextTitle = title.replace(/\s+/g, " ").trim();
  if (!nextTitle) {
    throw new Error("Title cannot be empty.");
  }
  const capped =
    nextTitle.length > 72 ? `${nextTitle.slice(0, 69).trimEnd()}...` : nextTitle;

  const [row] = await db
    .update(chat)
    .set({ title: capped, updatedAt: new Date() })
    .where(and(eq(chat.id, chatId), eq(chat.userId, userId)))
    .returning({
      id: chat.id,
      title: chat.title,
      updatedAt: chat.updatedAt,
    });

  if (!row) return null;

  return {
    id: row.id,
    title: row.title,
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Browser sandbox credentials for a chat. The control secret must never be
 * included in chat list or generic chat payloads — only browser routes and
 * the agent tool use this.
 */
export async function getChatBrowserSession(chatId: string): Promise<{
  readonly browserSandboxName: string | null;
  readonly browserControlSecret: string | null;
} | null> {
  const [row] = await db
    .select({
      browserSandboxName: chat.browserSandboxName,
      browserControlSecret: chat.browserControlSecret,
    })
    .from(chat)
    .where(eq(chat.id, chatId))
    .limit(1);

  return row ?? null;
}

export async function setChatBrowserSession({
  chatId,
  browserSandboxName,
  browserControlSecret,
}: {
  readonly chatId: string;
  readonly browserSandboxName: string;
  readonly browserControlSecret: string;
}): Promise<void> {
  await db
    .update(chat)
    .set({
      browserSandboxName,
      browserControlSecret,
      updatedAt: new Date(),
    })
    .where(eq(chat.id, chatId));
}

// ============================================================================
// Agent files
// ============================================================================

/**
 * Resolves the app chat id that owns an eve durable session. Returns null
 * when no chat row points at the session yet (for example while the very
 * first turn is still starting up).
 */
export async function getChatIdByEveSessionId(
  sessionId: string,
): Promise<string | null> {
  const [row] = await db
    .select({ id: chat.id })
    .from(chat)
    .where(sql`${chat.eveSession} ->> 'sessionId' = ${sessionId}`)
    .limit(1);

  return row?.id ?? null;
}

/**
 * The chat row linked to an eve session, with its owner: persistAgentFile
 * derives the principal-scoped Blob key from the owner, never model input.
 */
export async function getChatLinkByEveSessionId(
  sessionId: string,
): Promise<{ id: string; userId: string; title: string } | null> {
  const [row] = await db
    .select({ id: chat.id, userId: chat.userId, title: chat.title })
    .from(chat)
    .where(sql`${chat.eveSession} ->> 'sessionId' = ${sessionId}`)
    .limit(1);

  return row ?? null;
}

export type UpsertAgentFileInput = {
  readonly chatId: string;
  readonly path: string;
  readonly content: string;
  /** Set when the current content lives in Blob; then `content` is history-only. */
  readonly blobPathname?: string;
  /**
   * Override stored size when `content` is not the real body (blob-primary
   * binaries use an empty history marker).
   */
  readonly byteLength?: number;
};

/**
 * Durable mirror of a sandbox write. Idempotent per chat + path so retried
 * tool steps cannot duplicate rows.
 */
export async function upsertAgentFile({
  chatId,
  path,
  content,
  blobPathname,
  byteLength: byteLengthOverride,
}: UpsertAgentFileInput): Promise<void> {
  const byteLength =
    typeof byteLengthOverride === "number" && byteLengthOverride >= 0
      ? byteLengthOverride
      : Buffer.byteLength(content, "utf8");

  // No transaction here: the neon-http driver (production) does not support
  // them ("No transactions support in neon-http driver"), so these run as
  // sequential statements. Order matters — update the current content first,
  // then append the revision: a failure in between leaves the file content
  // current with one missing history row (recoverable), instead of a history
  // entry for content the file never held. Concurrent saves are already
  // serialized per file by withFileLock in the tools.
  const [revisionRow] = await db
    .select({
      next: sql<number>`COALESCE(MAX(${agentFileRevision.revision}), 0) + 1`,
    })
    .from(agentFileRevision)
    .where(
      and(eq(agentFileRevision.chatId, chatId), eq(agentFileRevision.path, path)),
    );

  await db
    .insert(agentFile)
    .values({
      id: randomUUID(),
      chatId,
      path,
      // Blob-primary: when the content lives in Blob, the row holds the
      // reference and no duplicate content.
      content: blobPathname ? null : content,
      blobPathname: blobPathname ?? null,
      byteLength,
    })
    .onConflictDoUpdate({
      target: [agentFile.chatId, agentFile.path],
      set: {
        content: blobPathname ? null : content,
        blobPathname: blobPathname ?? null,
        byteLength,
        updatedAt: new Date(),
      },
    });

  await db.insert(agentFileRevision).values({
    id: randomUUID(),
    chatId,
    path,
    revision: revisionRow.next,
    content,
    byteLength,
  });
}

export type AgentFileMeta = {
  readonly id: string;
  readonly path: string;
  readonly byteLength: number;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export async function listAgentFiles(
  chatId: string,
): Promise<readonly AgentFileMeta[]> {
  const rows = await db
    .select({
      id: agentFile.id,
      path: agentFile.path,
      byteLength: agentFile.byteLength,
      createdAt: agentFile.createdAt,
      updatedAt: agentFile.updatedAt,
    })
    .from(agentFile)
    .where(eq(agentFile.chatId, chatId))
    .orderBy(desc(agentFile.updatedAt));

  const versions = await agentFileVersionCounts(chatId);

  return rows.map((row) => ({
    id: row.id,
    path: row.path,
    byteLength: row.byteLength,
    version: versions.get(row.path) ?? 1,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));
}

// Current version number per path: MAX(revision) from the append-only
// history. Files without revisions (pre-history) read as version 1.
async function agentFileVersionCounts(
  chatId: string,
): Promise<ReadonlyMap<string, number>> {
  const rows = await db
    .select({
      path: agentFileRevision.path,
      version: sql<number>`MAX(${agentFileRevision.revision})`,
    })
    .from(agentFileRevision)
    .where(eq(agentFileRevision.chatId, chatId))
    .groupBy(agentFileRevision.path);

  return new Map(rows.map((row) => [row.path, Number(row.version) || 1]));
}

export type AgentFileContent = {
  readonly path: string;
  readonly content: string;
  readonly byteLength: number;
  readonly updatedAt: string;
};

export async function getAgentFile(
  chatId: string,
  fileId: string,
): Promise<AgentFileContent | null> {
  const [row] = await db
    .select({
      path: agentFile.path,
      content: agentFile.content,
      blobPathname: agentFile.blobPathname,
      byteLength: agentFile.byteLength,
      updatedAt: agentFile.updatedAt,
    })
    .from(agentFile)
    .where(and(eq(agentFile.chatId, chatId), eq(agentFile.id, fileId)))
    .limit(1);

  if (!row) {
    return null;
  }

  // Blob-primary: resolve the reference server-side. Binary paths return a
  // signed GET URL (clients download bytes); text paths return the body.
  // If the Blob read fails, fall back to any stored legacy content.
  if (row.blobPathname) {
    try {
      if (isBinaryWorkspacePath(row.path)) {
        const url = await signedPrivateBlobGetUrl(row.blobPathname);
        return {
          path: row.path,
          content: url,
          byteLength: row.byteLength,
          updatedAt: row.updatedAt.toISOString(),
        };
      }

      const content = await readPrivateBlobText(row.blobPathname);
      if (content !== null) {
        return {
          path: row.path,
          content,
          byteLength: row.byteLength,
          updatedAt: row.updatedAt.toISOString(),
        };
      }
    } catch {
      // Fall through to stored content below.
    }
  }

  if (row.content === null) {
    return null;
  }

  return {
    path: row.path,
    content: row.content,
    byteLength: row.byteLength,
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Files to seed into a fresh sandbox for this session's chat. */
export async function listAgentFileSeeds(
  chatId: string,
): Promise<
    readonly { path: string; content: string; updatedAt: Date }[]
  > {
  const rows = await db
    .select({
      path: agentFile.path,
      content: agentFile.content,
      updatedAt: agentFile.updatedAt,
    })
    .from(agentFile)
    .where(and(eq(agentFile.chatId, chatId), isNull(agentFile.blobPathname)))
    .orderBy(asc(agentFile.createdAt));

  // Rows with a blob_pathname reference are restored from Blob by the
  // sandbox's artifact restore (principal-scoped, newer-wins); only legacy
  // rows whose content lives here still seed from Postgres.
  return rows.filter((row) => row.content !== null) as readonly {
    path: string;
    content: string;
    updatedAt: Date;
  }[];
}

// ============================================================================
// Agent attachments (uploaded PDFs/images; extracted text read via tool)
// ============================================================================

export type SaveAgentAttachmentInput = {
  readonly userId: string;
  readonly name: string;
  readonly mediaType: string;
  readonly byteLength: number;
  readonly blobUrl: string | null;
  readonly pdfType: string | null;
  readonly pageCount: number | null;
  readonly pages: ReadonlyArray<{ page: number; markdown: string }> | null;
  readonly extractionNote: string | null;
};

/** Registers an uploaded attachment and returns its stable id. */
export async function saveAgentAttachment({
  userId,
  name,
  mediaType,
  byteLength,
  blobUrl,
  pdfType,
  pageCount,
  pages,
  extractionNote,
}: SaveAgentAttachmentInput): Promise<string> {
  const id = randomUUID();

  await db.insert(agentAttachment).values({
    id,
    userId,
    name,
    mediaType,
    byteLength,
    blobUrl,
    pdfType,
    pageCount,
    pages: pages ? pages.map((page) => ({ ...page })) : null,
    extractionNote,
  });

  return id;
}

/**
 * Attachment ownership runs through the chat: the eve session maps to a chat
 * row whose user must match the attachment's uploader.
 */
export async function getAgentAttachmentPage(
  attachmentId: string,
  sessionId: string,
  page: number,
): Promise<{ name: string; pageCount: number; markdown: string } | null> {
  const [chatRow] = await db
    .select({ userId: chat.userId })
    .from(chat)
    .where(sql`${chat.eveSession} ->> 'sessionId' = ${sessionId}`)
    .limit(1);

  if (!chatRow) {
    return null;
  }

  const [row] = await db
    .select({
      name: agentAttachment.name,
      pageCount: agentAttachment.pageCount,
      pages: agentAttachment.pages,
    })
    .from(agentAttachment)
    .where(
      and(
        eq(agentAttachment.id, attachmentId),
        eq(agentAttachment.userId, chatRow.userId),
      ),
    )
    .limit(1);

  if (!row) {
    return null;
  }

  const pages = row.pages ?? [];

  if (page > 0) {
    const found = pages.find((entry) => entry.page === page);
    return found
      ? { name: row.name, pageCount: row.pageCount ?? 0, markdown: found.markdown }
      : null;
  }

  return { name: row.name, pageCount: row.pageCount ?? 0, markdown: "" };
}

// Per-user usage rows for the settings page. Prefer current eve facts
// (`usage.recorded` + `model.started`); also read legacy `step.completed` /
// `step.started` so older chats still contribute. Events persist while the
// client streams the turn, so this reflects what the chat event log captured.
export type UserUsageRow = {
  readonly chatId: string;
  readonly turnId: string | null;
  readonly modelId: string | null;
  readonly createdAt: Date;
  readonly costUsd: number | null;
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
  readonly cacheReadTokens: number | null;
  readonly cacheWriteTokens: number | null;
};

/** Inclusive start / exclusive end window over `chat_event.created_at`. */
export type UserUsageRowRange = {
  readonly from?: Date | null;
  readonly to?: Date | null;
};

export async function getUserUsageRows(
  userId: string,
  range?: UserUsageRowRange,
): Promise<UserUsageRow[]> {
  const nullableNumber = (value: unknown): number | null => {
    if (value === null || value === undefined) {
      return null;
    }

    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const createdAtWindow = [
    range?.from ? gte(chatEvent.createdAt, range.from) : undefined,
    range?.to ? lt(chatEvent.createdAt, range.to) : undefined,
  ].filter((clause): clause is NonNullable<typeof clause> => clause != null);

  const [usageRows, legacySteps, models, legacyModels] = await Promise.all([
    db
      .select({
        chatId: chatEvent.chatId,
        turnId: sql<string | null>`coalesce(
          ${chatEvent.event} -> 'scope' ->> 'turnId',
          ${chatEvent.event} -> 'data' ->> 'turnId'
        )`,
        runId: sql<string | null>`coalesce(
          ${chatEvent.event} -> 'data' -> 'owner' ->> 'runId',
          ${chatEvent.event} -> 'data' ->> 'runId',
          ${chatEvent.event} -> 'scope' ->> 'runId'
        )`,
        kind: sql<string | null>`${chatEvent.event} -> 'data' ->> 'kind'`,
        ownerCallId: sql<string | null>`${chatEvent.event} -> 'data' -> 'owner' ->> 'callId'`,
        createdAt: chatEvent.createdAt,
        costUsd: sql<unknown>`coalesce(
          ${chatEvent.event} -> 'data' -> 'usage' ->> 'costUsd',
          ${chatEvent.event} -> 'data' ->> 'costUsd'
        )`,
        inputTokens: sql<unknown>`coalesce(
          ${chatEvent.event} -> 'data' -> 'usage' ->> 'inputTokens',
          ${chatEvent.event} -> 'data' ->> 'inputTokens'
        )`,
        outputTokens: sql<unknown>`coalesce(
          ${chatEvent.event} -> 'data' -> 'usage' ->> 'outputTokens',
          ${chatEvent.event} -> 'data' ->> 'outputTokens'
        )`,
        cacheReadTokens: sql<unknown>`coalesce(
          ${chatEvent.event} -> 'data' -> 'usage' ->> 'cacheReadTokens',
          ${chatEvent.event} -> 'data' ->> 'cacheReadTokens'
        )`,
        cacheWriteTokens: sql<unknown>`coalesce(
          ${chatEvent.event} -> 'data' -> 'usage' ->> 'cacheWriteTokens',
          ${chatEvent.event} -> 'data' ->> 'cacheWriteTokens'
        )`,
      })
      .from(chatEvent)
      .innerJoin(chat, eq(chatEvent.chatId, chat.id))
      .where(
        and(
          eq(chat.userId, userId),
          sql`${chatEvent.event} ->> 'type' = 'usage.recorded'`,
          ...createdAtWindow,
        ),
      ),
    db
      .select({
        chatId: chatEvent.chatId,
        turnId: sql<string | null>`${chatEvent.event} -> 'data' ->> 'turnId'`,
        createdAt: chatEvent.createdAt,
        costUsd: sql<unknown>`${chatEvent.event} -> 'data' -> 'usage' ->> 'costUsd'`,
        inputTokens: sql<unknown>`${chatEvent.event} -> 'data' -> 'usage' ->> 'inputTokens'`,
        outputTokens: sql<unknown>`${chatEvent.event} -> 'data' -> 'usage' ->> 'outputTokens'`,
        cacheReadTokens: sql<unknown>`${chatEvent.event} -> 'data' -> 'usage' ->> 'cacheReadTokens'`,
        cacheWriteTokens: sql<unknown>`${chatEvent.event} -> 'data' -> 'usage' ->> 'cacheWriteTokens'`,
      })
      .from(chatEvent)
      .innerJoin(chat, eq(chatEvent.chatId, chat.id))
      .where(
        and(
          eq(chat.userId, userId),
          sql`${chatEvent.event} ->> 'type' = 'step.completed'`,
          ...createdAtWindow,
        ),
      ),
    db
      .select({
        chatId: chatEvent.chatId,
        runId: sql<string | null>`${chatEvent.event} -> 'data' ->> 'runId'`,
        turnId: sql<string | null>`coalesce(
          ${chatEvent.event} -> 'scope' ->> 'turnId',
          ${chatEvent.event} -> 'data' ->> 'turnId'
        )`,
        modelId: sql<string | null>`${chatEvent.event} -> 'data' ->> 'modelId'`,
      })
      .from(chatEvent)
      .innerJoin(chat, eq(chatEvent.chatId, chat.id))
      .where(
        and(
          eq(chat.userId, userId),
          sql`${chatEvent.event} ->> 'type' = 'model.started'`,
        ),
      ),
    db
      .select({
        chatId: chatEvent.chatId,
        turnId: sql<string | null>`${chatEvent.event} -> 'data' ->> 'turnId'`,
        modelId: sql<string | null>`${chatEvent.event} -> 'data' ->> 'modelId'`,
      })
      .from(chatEvent)
      .innerJoin(chat, eq(chatEvent.chatId, chat.id))
      .where(
        and(
          eq(chat.userId, userId),
          sql`${chatEvent.event} ->> 'type' = 'step.started'`,
        ),
      ),
  ]);

  const modelByRun = new Map<string, string | null>();
  const modelByTurn = new Map<string, string | null>();
  for (const row of models) {
    if (row.runId) {
      modelByRun.set(`${row.chatId}::${row.runId}`, row.modelId);
    }
    if (row.turnId) {
      modelByTurn.set(`${row.chatId}::${row.turnId}`, row.modelId);
    }
  }
  for (const row of legacyModels) {
    if (!row.turnId) continue;
    modelByTurn.set(`${row.chatId}::${row.turnId}`, row.modelId);
  }

  const fromUsage = usageRows
    .filter((row) => {
      if (row.kind === "delegated-late") return false;
      if (row.ownerCallId && !row.runId) return false;
      return true;
    })
    .map((row) => ({
      cacheReadTokens: nullableNumber(row.cacheReadTokens),
      cacheWriteTokens: nullableNumber(row.cacheWriteTokens),
      chatId: row.chatId,
      costUsd: nullableNumber(row.costUsd),
      createdAt: row.createdAt,
      inputTokens: nullableNumber(row.inputTokens),
      modelId: row.runId
        ? (modelByRun.get(`${row.chatId}::${row.runId}`) ??
          (row.turnId
            ? (modelByTurn.get(`${row.chatId}::${row.turnId}`) ?? null)
            : null))
        : row.turnId
          ? (modelByTurn.get(`${row.chatId}::${row.turnId}`) ?? null)
          : null,
      outputTokens: nullableNumber(row.outputTokens),
      turnId: row.turnId,
    }));

  // Prefer usage.recorded when present; only fall back to legacy steps when a
  // chat has no modern usage facts (avoid double-counting converted history).
  const chatsWithUsage = new Set(fromUsage.map((row) => row.chatId));
  const fromLegacy = legacySteps
    .filter((row) => !chatsWithUsage.has(row.chatId))
    .map((row) => ({
      cacheReadTokens: nullableNumber(row.cacheReadTokens),
      cacheWriteTokens: nullableNumber(row.cacheWriteTokens),
      chatId: row.chatId,
      costUsd: nullableNumber(row.costUsd),
      createdAt: row.createdAt,
      inputTokens: nullableNumber(row.inputTokens),
      modelId: row.turnId
        ? (modelByTurn.get(`${row.chatId}::${row.turnId}`) ?? null)
        : null,
      outputTokens: nullableNumber(row.outputTokens),
      turnId: row.turnId,
    }));

  return [...fromUsage, ...fromLegacy];
}

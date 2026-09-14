import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, gte, lt, or, sql } from "drizzle-orm";
import type { ClientSessionState, MessageStreamEvent } from "eve/client";
import { isChatTurnSettledEvent } from "@/lib/chat/events";
import type { ActiveChat, ChatListItem, ChatListPage } from "@/lib/chat/types";
import { createFallbackTitle, DEFAULT_CHAT_TITLE } from "@/lib/chat/title";
import { chat, chatEvent, agentFile } from "@/lib/db/schema";
import { db } from "@/lib/db/client";

const CHAT_HISTORY_PAGE_SIZE = 20;

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
    })
    .from(chat)
    .where(
      and(
        eq(chat.userId, userId),
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

  return {
    items: pageRows.map((row) => ({
      id: row.id,
      title: row.title,
      updatedAt: row.updatedAt.toISOString(),
    })),
    nextCursor: hasMore && last ? encodeChatCursor(last.updatedAt, last.id) : null,
  };
}

export async function createChat(
  userId: string,
  {
    pendingUserMessage,
  }: {
    readonly pendingUserMessage?: string;
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
    })
    .returning({
      id: chat.id,
      title: chat.title,
      updatedAt: chat.updatedAt,
    });

  if (!row) {
    throw new Error("Failed to create chat.");
  }

  return {
    id: row.id,
    title: row.title,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function getChatForUser(chatId: string, userId: string): Promise<ActiveChat | null> {
  const [row] = await db
    .select({
      id: chat.id,
      title: chat.title,
      eveSession: chat.eveSession,
      pendingUserMessage: chat.pendingUserMessage,
      pendingUserMessageCreatedAt: chat.pendingUserMessageCreatedAt,
    })
    .from(chat)
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

  return {
    events: eventValues,
    id: row.id,
    pendingUserMessage: hasCurrentTurnCompleted ? null : row.pendingUserMessage,
    session: row.eveSession ?? undefined,
    title: row.title,
  };
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
  readonly events: readonly MessageStreamEvent[];
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
  readonly event: MessageStreamEvent;
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

export async function saveChatSnapshot({
  chatId,
  events,
  session,
  userId,
}: {
  readonly chatId: string;
  readonly events: readonly MessageStreamEvent[];
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
      updatedAt: new Date(),
    })
    .where(and(eq(chat.id, chatId), eq(chat.userId, userId)));
}

export async function deleteChatForUser(chatId: string, userId: string) {
  await db.delete(chat).where(and(eq(chat.id, chatId), eq(chat.userId, userId)));
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

export type UpsertAgentFileInput = {
  readonly chatId: string;
  readonly path: string;
  readonly content: string;
};

/**
 * Durable mirror of a sandbox write. Idempotent per chat + path so retried
 * tool steps cannot duplicate rows.
 */
export async function upsertAgentFile({
  chatId,
  path,
  content,
}: UpsertAgentFileInput): Promise<void> {
  const byteLength = Buffer.byteLength(content, "utf8");

  await db
    .insert(agentFile)
    .values({ id: randomUUID(), chatId, path, content, byteLength })
    .onConflictDoUpdate({
      target: [agentFile.chatId, agentFile.path],
      set: { content, byteLength, updatedAt: new Date() },
    });
}

export type AgentFileMeta = {
  readonly id: string;
  readonly path: string;
  readonly byteLength: number;
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

  return rows.map((row) => ({
    id: row.id,
    path: row.path,
    byteLength: row.byteLength,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));
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
      byteLength: agentFile.byteLength,
      updatedAt: agentFile.updatedAt,
    })
    .from(agentFile)
    .where(and(eq(agentFile.chatId, chatId), eq(agentFile.id, fileId)))
    .limit(1);

  if (!row) {
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
): Promise<readonly { path: string; content: string }[]> {
  const rows = await db
    .select({ path: agentFile.path, content: agentFile.content })
    .from(agentFile)
    .where(eq(agentFile.chatId, chatId))
    .orderBy(asc(agentFile.createdAt));

  return rows;
}

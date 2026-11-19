// Client-side execution of live voice chat tools against eve + chats REST.

import type { SessionStore } from "eve/client";

import { isEveSessionInactive } from "../../lib/chat/eve-session-recovery";
import {
  createChat,
  getChat,
  listChats,
  searchChats,
  type ChatListItem,
  type ChatSearchHit,
} from "./chats-client";
import {
  LIVE_ASK_PEARL_DEFAULT_TIMEOUT_MS,
  LIVE_ASK_PEARL_SEND_TIMEOUT_MS,
  LIVE_CHAT_TRANSCRIPT_MAX_CHARS,
  LIVE_VOICE_REPLY_MAX_CHARS,
  clampAskTimeout,
  formatChatTranscriptForVoice,
  formatTranscriptLines,
  lastAssistantPlainText,
  linesFromEveMessages,
  raceWithTimeout,
  truncateForVoice,
} from "./live-chat-tools";
import { hasPendingAction } from "./message-projection";
import { shouldRestoreUnsentDraft } from "./send-feedback";
import { buildTurnClientContext } from "./turn-client-context";

export type AskPearlContext = {
  readonly getStore: () => SessionStore;
  readonly getActiveChatId: () => string | null;
  readonly activeProjectId: string | null;
  readonly activeCustomAgentId?: string | null;
  readonly selectChat: (chatId: string) => Promise<boolean>;
  readonly wasSendPrepared: (source: SessionStore) => boolean;
  readonly clearPendingMessage: (source: SessionStore) => void;
  readonly recoverDeadSession: (source: SessionStore) => boolean;
  /**
   * Fired when prepareSend first materializes a chat id on the voice anchor
   * (null → id). Does not retarget spoken save away from the anchor.
   */
  readonly onAnchorEnsured?: (chatId: string) => void;
};

export type AskPearlResult =
  | {
      readonly status: "ok";
      readonly chatId: string;
      readonly reply: string;
      readonly truncated: boolean;
    }
  | {
      readonly status: "needs_input";
      readonly chatId: string;
      readonly summary: string;
    }
  | {
      readonly status: "error";
      readonly error: string;
      readonly chatId?: string;
    };

export type LiveToolExecContext = AskPearlContext & {
  /** Voice-anchor chat id; ask_pearl defaults here (no new Recents rows). */
  readonly defaultChatId: string | null;
};

function compactChatListItem(chat: ChatListItem) {
  return {
    id: chat.id,
    title: chat.title,
    updatedAt: chat.updatedAt,
    presence: chat.presence ?? (chat.waitingForInput ? "waiting" : "idle"),
    projectId: chat.projectId ?? null,
  };
}

function compactSearchHit(chat: ChatSearchHit) {
  return {
    id: chat.id,
    title: chat.title,
    updatedAt: chat.updatedAt,
    presence: chat.presence,
    snippet: chat.snippet,
    projectId: chat.projectId,
  };
}

export async function runAskPearl(
  ctx: AskPearlContext,
  args: {
    readonly message: string;
    readonly chatId?: string | null;
    readonly timeoutMs?: number;
  },
): Promise<AskPearlResult> {
  const message = args.message.trim();
  if (!message) {
    return { status: "error", error: "ask_pearl requires a non-empty message." };
  }

  const timeoutMs = clampAskTimeout(
    args.timeoutMs ?? LIVE_ASK_PEARL_DEFAULT_TIMEOUT_MS,
  );
  const sendTimeoutMs = Math.min(timeoutMs, LIVE_ASK_PEARL_SEND_TIMEOUT_MS);

  let store = ctx.getStore();
  const priorChatId = ctx.getActiveChatId();
  // Prefer explicit past-thread id, else voice anchor / active chat.
  // Do not createChat here — prepareSend on the anchor store creates if needed.
  let chatId = args.chatId?.trim() || priorChatId;

  if (chatId && chatId !== priorChatId) {
    const ok = await ctx.selectChat(chatId);
    if (!ok) {
      return { status: "error", error: `Could not open chat ${chatId}.`, chatId };
    }
    store = ctx.getStore();
  }

  const sendPayload = {
    message,
    clientContext: buildTurnClientContext(
      ctx.activeProjectId,
      chatId,
      ctx.activeCustomAgentId,
    ),
  };

  try {
    let delivery = await raceWithTimeout(
      store.send(sendPayload),
      sendTimeoutMs,
      "ask_pearl send",
    );
    if (
      isEveSessionInactive(store.snapshot.error) &&
      ctx.recoverDeadSession(store)
    ) {
      delivery = await raceWithTimeout(
        store.send(sendPayload),
        sendTimeoutMs,
        "ask_pearl send retry",
      );
    }
    if (shouldRestoreUnsentDraft(store.snapshot.error, ctx.wasSendPrepared(store))) {
      return {
        status: "error",
        error: "Could not start the eve turn.",
        chatId: ctx.getActiveChatId() ?? chatId ?? undefined,
      };
    }
    if (delivery?.deliveryId) {
      ctx.clearPendingMessage(store);
    }

    chatId = ctx.getActiveChatId() ?? chatId;
    if (chatId && !priorChatId) {
      ctx.onAnchorEnsured?.(chatId);
    }
    if (!chatId) {
      return { status: "error", error: "Could not resolve the voice chat id." };
    }

    const result = await delivery.result({
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (hasPendingAction(store.snapshot)) {
      const summary = truncateForVoice(
        result.reply?.trim() ||
          lastAssistantPlainText(store.snapshot.messages) ||
          "Pearl is waiting for a confirmation in the app.",
        LIVE_VOICE_REPLY_MAX_CHARS,
      ).text;
      return { status: "needs_input", chatId, summary };
    }

    if (result.status === "failed") {
      return {
        status: "error",
        error: result.error?.message ?? "The eve turn failed.",
        chatId,
      };
    }

    const raw =
      result.reply?.trim() ||
      lastAssistantPlainText(store.snapshot.messages) ||
      "";
    if (!raw) {
      return {
        status: "error",
        error: "The eve turn finished without a text reply.",
        chatId,
      };
    }
    const clipped = truncateForVoice(raw, LIVE_VOICE_REPLY_MAX_CHARS);
    return {
      status: "ok",
      chatId,
      reply: clipped.truncated
        ? `${clipped.text}\n\n(Reply truncated for speech.)`
        : clipped.text,
      truncated: clipped.truncated,
    };
  } catch (cause) {
    const error =
      cause instanceof Error ? cause.message : "Could not complete ask_pearl.";
    return {
      status: "error",
      error,
      chatId: ctx.getActiveChatId() ?? chatId ?? undefined,
    };
  }
}

export async function executeLiveChatTool(
  name: string,
  rawArgs: string,
  ctx: LiveToolExecContext,
): Promise<unknown> {
  let args: Record<string, unknown> = {};
  try {
    args = rawArgs.trim() ? (JSON.parse(rawArgs) as Record<string, unknown>) : {};
  } catch {
    return { error: "Invalid tool arguments JSON." };
  }

  try {
    switch (name) {
      case "list_chats": {
        const cursor =
          typeof args.cursor === "string" && args.cursor.trim()
            ? args.cursor.trim()
            : null;
        const page = await listChats(cursor);
        return {
          chats: page.chats.map(compactChatListItem),
          nextCursor: page.nextCursor,
        };
      }
      case "search_chats": {
        const query = typeof args.query === "string" ? args.query.trim() : "";
        if (!query) return { error: "search_chats requires query." };
        const chats = await searchChats(query);
        return { chats: chats.map(compactSearchHit) };
      }
      case "read_chat": {
        const chatId = typeof args.chatId === "string" ? args.chatId.trim() : "";
        if (!chatId) return { error: "read_chat requires chatId." };
        const maxChars =
          typeof args.maxChars === "number" && Number.isFinite(args.maxChars)
            ? Math.max(500, Math.min(12_000, Math.floor(args.maxChars)))
            : LIVE_CHAT_TRANSCRIPT_MAX_CHARS;
        if (chatId === ctx.getActiveChatId()) {
          return {
            chatId,
            title: "Current chat",
            transcript: formatTranscriptLines(
              "Current chat",
              linesFromEveMessages(ctx.getStore().snapshot.messages),
              maxChars,
            ),
          };
        }
        const chat = await getChat(chatId);
        if (!chat) return { error: `Chat ${chatId} not found.` };
        return {
          chatId: chat.id,
          title: chat.title,
          transcript: formatChatTranscriptForVoice(chat, maxChars),
        };
      }
      case "create_chat": {
        // Rare during live; still creates a Recents row but does not move the
        // voice-anchor spoken-save target.
        const titleHint =
          typeof args.titleHint === "string" ? args.titleHint.trim() : "";
        const created = await createChat(
          titleHint || undefined,
          ctx.activeProjectId,
        );
        const ok = await ctx.selectChat(created.id);
        return {
          id: created.id,
          title: created.title,
          selected: ok,
        };
      }
      case "ask_pearl": {
        const message = typeof args.message === "string" ? args.message : "";
        const chatId =
          typeof args.chatId === "string" && args.chatId.trim()
            ? args.chatId.trim()
            : ctx.defaultChatId;
        return await runAskPearl(ctx, {
          message,
          chatId,
          timeoutMs:
            typeof args.timeoutMs === "number" ? args.timeoutMs : undefined,
        });
      }
      default:
        return { error: `Unknown tool: ${name}` };
    }
  } catch (cause) {
    return {
      error: cause instanceof Error ? cause.message : "Tool execution failed.",
    };
  }
}

// Pure realtime tool defs + transcript helpers for live voice.
// Client-side execution lives in live-chat-tool-exec.ts (keeps Node unit tests light).

import type { EveMessage } from "eve/client";

import type { SpokenTurn } from "../../lib/chat/spoken-turns";

export const LIVE_ASK_PEARL_DEFAULT_TIMEOUT_MS = 120_000;
export const LIVE_ASK_PEARL_MAX_TIMEOUT_MS = 5 * 60_000;
/** Cap for store.send before delivery.result so a hung accept cannot pin the call. */
export const LIVE_ASK_PEARL_SEND_TIMEOUT_MS = 60_000;
/** Keep working chrome after a tool returns until Grok starts speaking. */
export const LIVE_POST_TOOL_AUDIO_TIMEOUT_MS = 8_000;
export const LIVE_VOICE_REPLY_MAX_CHARS = 2_000;
export const LIVE_CHAT_TRANSCRIPT_MAX_CHARS = 4_000;

export type LiveChatToolDefinition = {
  readonly type: "function";
  readonly name: string;
  readonly description: string;
  readonly parameters: {
    readonly type: "object";
    readonly properties: Record<string, unknown>;
    readonly required?: readonly string[];
    readonly additionalProperties?: boolean;
  };
};

export const LIVE_CHAT_TOOLS: readonly LiveChatToolDefinition[] = [
  {
    type: "function",
    name: "list_chats",
    description:
      "List the user's recent eve chats (id, title, updatedAt, presence). Use when they ask what threads they have.",
    parameters: {
      type: "object",
      properties: {
        cursor: {
          type: "string",
          description: "Optional pagination cursor from a previous list_chats call.",
        },
      },
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "search_chats",
    description:
      "Search the user's eve chats by title or message text. Prefer this over guessing past context.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query.",
        },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "read_chat",
    description:
      "Read a compact transcript of one eve chat by id. Use after list_chats or search_chats.",
    parameters: {
      type: "object",
      properties: {
        chatId: { type: "string", description: "Chat id to read." },
        maxChars: {
          type: "number",
          description: "Max transcript characters (default 4000).",
        },
      },
      required: ["chatId"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "create_chat",
    description:
      "Create a new eve chat. Becomes the default target for ask_pearl and for saving this live call.",
    parameters: {
      type: "object",
      properties: {
        titleHint: {
          type: "string",
          description: "Optional short hint used as the pending first message / title seed.",
        },
      },
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "ask_pearl",
    description:
      "Send a real task to the eve Pearl agent (inbox, GitHub, research, code, connected tools). Wait for the turn to finish, then use the returned text to answer out loud. Do not invent results.",
    parameters: {
      type: "object",
      properties: {
        message: {
          type: "string",
          description: "Clear task for the eve agent.",
        },
        chatId: {
          type: "string",
          description:
            "Optional past chat id from list/search/read. Defaults to this live conversation (do not create a new chat).",
        },
        timeoutMs: {
          type: "number",
          description: "How long to wait for the turn (default 120000, max 300000).",
        },
      },
      required: ["message"],
      additionalProperties: false,
    },
  },
];

export const LIVE_BASE_INSTRUCTIONS =
  "You are Pearl, a personal agent in a live voice conversation. On the first response, greet the user in one short spoken sentence and invite them to talk. After that, answer out loud and briefly. " +
  "You can list, search, and read the user's real eve chats with your tools. When a current chat is seeded below, use it first and do not invent chat contents. " +
  "For anything that needs real work (inbox, GitHub, research, code, connected tools), call ask_pearl with a clear task on this same conversation, wait for the tool result, then paraphrase the answer for speech — do not invent results. " +
  "ask_pearl runs on this voice thread; subagent work stays here for the user to open in the Pearl app. If ask_pearl returns needs_input, tell them to check this chat for a confirmation. " +
  "If the user shares a camera frame and the model receives it, say what you see; otherwise stay on the voice conversation.";

/** Friendly live-modal label for a realtime tool name. */
export function liveToolActivityLabel(name: string): string {
  switch (name) {
    case "ask_pearl":
      return "Asking Pearl…";
    case "list_chats":
    case "search_chats":
    case "read_chat":
      return "Checking your chats…";
    case "create_chat":
      return "Starting a chat…";
    default:
      return "Working…";
  }
}

export function formatLiveElapsed(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

/** Race a promise against a wall-clock timeout (for store.send without AbortSignal). */
export function raceWithTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms`));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export function truncateWorkTitle(message: string, max = 48): string {
  const line = message.split("\n")[0]?.trim() ?? "";
  if (!line) return "Pearl";
  if (line.length <= max) return line;
  return `${line.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

export type LivePrimaryWorkPhase =
  | "running"
  | "answering"
  | "needs_input"
  | "error"
  | "done";

/** Primary ask_pearl / tool card for the live modal (no subagent deps). */
export function primaryAskPearlCard(input: {
  readonly toolName: string;
  readonly taskMessage: string;
  readonly phase: LivePrimaryWorkPhase;
  readonly messages: readonly EveMessage[];
  readonly storeWaiting: boolean;
  readonly errorText?: string;
  readonly summaryText?: string;
}): {
  readonly key: string;
  readonly label: string;
  readonly activity?: string;
  readonly state: "working" | "waiting" | "done" | "failed";
  readonly result?: string;
} {
  const label =
    input.toolName === "ask_pearl"
      ? truncateWorkTitle(input.taskMessage)
      : liveToolActivityLabel(input.toolName);

  if (input.phase === "needs_input") {
    return {
      key: "ask",
      label,
      state: "waiting",
      activity: "Needs confirmation in Pearl",
      result: input.summaryText,
    };
  }
  if (input.phase === "error") {
    return {
      key: "ask",
      label,
      state: "failed",
      result: input.errorText ?? "Something went wrong.",
    };
  }
  if (input.phase === "answering") {
    return {
      key: "ask",
      label,
      state: "done",
      activity: "Got it — answering…",
      result: input.summaryText,
    };
  }
  if (input.phase === "done") {
    return {
      key: "ask",
      label,
      state: "done",
      result: input.summaryText,
    };
  }

  const preview = lastAssistantPlainText(input.messages);
  return {
    key: "ask",
    label,
    state: input.storeWaiting ? "waiting" : "working",
    activity: input.storeWaiting
      ? "Waiting for confirmation…"
      : preview
        ? undefined
        : liveToolActivityLabel(input.toolName),
    result: preview ? preview.slice(0, 400) : undefined,
  };
}

export type LiveTranscriptLine = {
  readonly role: "user" | "assistant";
  readonly text: string;
};

export function truncateForVoice(
  text: string,
  maxChars: number,
): { readonly text: string; readonly truncated: boolean } {
  const trimmed = text.trim();
  if (trimmed.length <= maxChars) return { text: trimmed, truncated: false };
  return {
    text: `${trimmed.slice(0, Math.max(0, maxChars - 1)).trimEnd()}…`,
    truncated: true,
  };
}

export function linesFromEveMessages(
  messages: readonly EveMessage[],
): LiveTranscriptLine[] {
  const lines: LiveTranscriptLine[] = [];
  for (const message of messages) {
    if (message.role !== "user" && message.role !== "assistant") continue;
    const text = message.parts
      .filter(
        (part): part is Extract<(typeof message.parts)[number], { type: "text" }> =>
          part.type === "text" && typeof part.text === "string",
      )
      .map((part) => part.text.trim())
      .filter(Boolean)
      .join("\n")
      .trim();
    if (!text) continue;
    lines.push({
      role: message.role === "assistant" ? "assistant" : "user",
      text,
    });
  }
  return lines;
}

export function linesFromSpokenTurns(
  turns: readonly SpokenTurn[],
): LiveTranscriptLine[] {
  return turns
    .map((turn) => {
      const text = turn.text.trim();
      if (!text) return null;
      return {
        role: (turn.role === "assistant" ? "assistant" : "user") as
          | "user"
          | "assistant",
        text,
      };
    })
    .filter((line): line is LiveTranscriptLine => line != null);
}

/** Best-effort transcript from durable chat events when EveMessage[] is unavailable. */
export function linesFromChatEvents(
  events: readonly { readonly type?: string; readonly data?: unknown }[],
): LiveTranscriptLine[] {
  const lines: LiveTranscriptLine[] = [];
  for (const event of events) {
    if (event.type === "delivery.consumed") {
      const data = event.data as
        | { parts?: readonly { kind?: string; text?: string }[] }
        | undefined;
      const text = (data?.parts ?? [])
        .filter((part) => part.kind === "text" && typeof part.text === "string")
        .map((part) => part.text!.trim())
        .filter(Boolean)
        .join("\n")
        .trim();
      if (text) lines.push({ role: "user", text });
      continue;
    }
    if (event.type === "content.completed") {
      const data = event.data as
        | { kind?: string; phase?: string; value?: unknown }
        | undefined;
      if (data?.kind !== "text" || typeof data.value !== "string") continue;
      const text = data.value.trim();
      if (!text) continue;
      lines.push({ role: "assistant", text });
    }
  }
  return lines;
}

export function formatTranscriptLines(
  title: string,
  lines: readonly LiveTranscriptLine[],
  maxChars = LIVE_CHAT_TRANSCRIPT_MAX_CHARS,
): string {
  const body = lines
    .map((line) => `${line.role === "user" ? "User" : "Pearl"}: ${line.text}`)
    .join("\n");
  const header = title.trim() ? `Chat: ${title.trim()}\n\n` : "";
  const full = `${header}${body}`.trim();
  const clipped = truncateForVoice(full, maxChars);
  return clipped.truncated
    ? `${clipped.text}\n\n(Transcript truncated.)`
    : clipped.text;
}

export function formatChatTranscriptForVoice(
  chat: {
    readonly title: string;
    readonly events: readonly { readonly type?: string; readonly data?: unknown }[];
    readonly spokenTurns?: readonly SpokenTurn[];
    readonly messages?: readonly EveMessage[];
  },
  maxChars = LIVE_CHAT_TRANSCRIPT_MAX_CHARS,
): string {
  const fromMessages = chat.messages?.length
    ? linesFromEveMessages(chat.messages)
    : [];
  const lines =
    fromMessages.length > 0
      ? fromMessages
      : [
          ...linesFromChatEvents(chat.events),
          ...linesFromSpokenTurns(chat.spokenTurns ?? []),
        ];
  if (lines.length === 0) {
    return `Chat: ${chat.title}\n\n(No messages yet.)`;
  }
  return formatTranscriptLines(chat.title, lines, maxChars);
}

export function buildLiveInstructions(seed?: {
  readonly chatId?: string | null;
  readonly title?: string | null;
  readonly transcript?: string | null;
}): string {
  const parts = [LIVE_BASE_INSTRUCTIONS];
  if (seed?.chatId) {
    parts.push(
      `\n\nCurrent chat id: ${seed.chatId}` +
        (seed.title ? ` (“${seed.title}”)` : "") +
        ". Prefer this chat for ask_pearl unless the user asks otherwise.",
    );
  }
  if (seed?.transcript?.trim()) {
    parts.push(`\n\nCurrent chat context:\n${seed.transcript.trim()}`);
  }
  return parts.join("");
}

export function liveFunctionCallOutputEvent(input: {
  readonly callId: string;
  readonly name: string;
  readonly output: string;
}) {
  return {
    type: "conversation-item-create" as const,
    item: {
      type: "function-call-output" as const,
      callId: input.callId,
      name: input.name,
      output: input.output,
    },
  };
}

export function lastAssistantPlainText(messages: readonly EveMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (!message || message.role !== "assistant") continue;
    const text = message.parts
      .filter(
        (part): part is Extract<(typeof message.parts)[number], { type: "text" }> =>
          part.type === "text" && typeof part.text === "string",
      )
      .map((part) => part.text.trim())
      .filter(Boolean)
      .join("\n")
      .trim();
    if (text) return text;
  }
  return "";
}

export function clampAskTimeout(timeoutMs: unknown): number {
  const n =
    typeof timeoutMs === "number" && Number.isFinite(timeoutMs)
      ? timeoutMs
      : LIVE_ASK_PEARL_DEFAULT_TIMEOUT_MS;
  return Math.min(
    LIVE_ASK_PEARL_MAX_TIMEOUT_MS,
    Math.max(5_000, Math.floor(n)),
  );
}

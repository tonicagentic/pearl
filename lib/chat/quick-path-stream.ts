import type { QuickTurn } from "./quick-turns.ts";

export type QuickPathStreamEvent =
  | { readonly type: "text-delta"; readonly delta: string }
  | { readonly type: "escalate" }
  | {
      readonly type: "done";
      readonly turns: readonly QuickTurn[];
      readonly chatId: string;
      readonly title?: string;
    }
  | { readonly type: "error"; readonly message: string };

function parseLine(line: string): QuickPathStreamEvent | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed) as QuickPathStreamEvent;
    if (
      parsed &&
      typeof parsed === "object" &&
      typeof (parsed as { type?: unknown }).type === "string"
    ) {
      return parsed;
    }
  } catch {
    // Ignore malformed lines.
  }
  return null;
}

/**
 * Consume the quick-path NDJSON stream from `/api/chat/quick`.
 */
export async function readQuickPathStream(
  response: Response,
  handlers: {
    readonly onTextDelta?: (delta: string) => void;
    readonly onEscalate?: () => void;
    readonly onDone?: (payload: {
      readonly turns: readonly QuickTurn[];
      readonly chatId: string;
      readonly title?: string;
    }) => void;
    readonly onError?: (message: string) => void;
  } = {},
): Promise<
  | {
      readonly outcome: "answered";
      readonly turns: readonly QuickTurn[];
      readonly chatId: string;
      readonly title?: string;
    }
  | { readonly outcome: "escalate" }
  | { readonly outcome: "error"; readonly message: string }
> {
  if (!response.ok || !response.body) {
    const message = `Quick path failed (${response.status}).`;
    handlers.onError?.(message);
    return { outcome: "error", message };
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let escalated = false;
  let donePayload:
    | {
        readonly turns: readonly QuickTurn[];
        readonly chatId: string;
        readonly title?: string;
      }
    | null = null;
  let errorMessage: string | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const event = parseLine(line);
      if (!event) continue;
      if (event.type === "text-delta") {
        handlers.onTextDelta?.(event.delta);
      } else if (event.type === "escalate") {
        escalated = true;
        handlers.onEscalate?.();
      } else if (event.type === "done") {
        donePayload = {
          turns: event.turns,
          chatId: event.chatId,
          ...(typeof event.title === "string" ? { title: event.title } : {}),
        };
        handlers.onDone?.(donePayload);
      } else if (event.type === "error") {
        errorMessage = event.message;
        handlers.onError?.(event.message);
      }
    }
  }

  if (buffer.trim()) {
    const event = parseLine(buffer);
    if (event?.type === "text-delta") handlers.onTextDelta?.(event.delta);
    if (event?.type === "escalate") {
      escalated = true;
      handlers.onEscalate?.();
    }
    if (event?.type === "done") {
      donePayload = {
        turns: event.turns,
        chatId: event.chatId,
        ...(typeof event.title === "string" ? { title: event.title } : {}),
      };
      handlers.onDone?.(donePayload);
    }
    if (event?.type === "error") {
      errorMessage = event.message;
      handlers.onError?.(event.message);
    }
  }

  if (escalated) return { outcome: "escalate" };
  if (errorMessage) return { outcome: "error", message: errorMessage };
  if (donePayload) {
    return {
      outcome: "answered",
      turns: donePayload.turns,
      chatId: donePayload.chatId,
      ...(donePayload.title ? { title: donePayload.title } : {}),
    };
  }
  return { outcome: "error", message: "Quick path ended without a reply." };
}

/**
 * Minimal message shape used by the pending-assistant helper. Avoid importing
 * `@assistant-ui/react-native` here so root Next.js typecheck (which can still
 * see this file via tests) does not need the mobile-only package.
 */
export type ThreadMessageLike = {
  readonly role: string;
  readonly content?: unknown;
  readonly status?: { readonly type?: string };
  readonly metadata?: { readonly status?: string };
};

/**
 * Live reveal: show every character the model has already produced.
 * The old typewriter caps are gone so Inkling / Ultramarine feel as fast
 * as they are.
 */
export function nextRevealLength(
  text: string,
  from: number,
  _elapsedMs = 0,
  _options?: unknown,
): { end: number; carry: number } {
  if (from >= text.length) return { end: text.length, carry: 0 };
  return { end: text.length, carry: 0 };
}

// The pending assistant row owns one quiet pre-content label. Reasoning and
// tool steps hand off to the timeline; text and media hand off to their parts.
export function shouldShowThinking(
  running: boolean,
  parts: readonly { type: string; text?: string }[],
): boolean {
  return running && !parts.some((part) =>
    part.type === "text" ? Boolean(part.text?.length) :
      part.type === "reasoning" || part.type === "tool-call" ||
      part.type === "data" || part.type === "file" || part.type === "image",
  );
}

function isDisplayOnlyPendingAssistant(
  message: ThreadMessageLike | undefined,
): boolean {
  if (!message || message.role !== "assistant") return false;
  const content = message.content;
  const parts = Array.isArray(content) ? content : [];
  if (parts.length > 0) return false;
  const metadata = message.metadata as
    | { readonly custom?: { readonly turnId?: string }; readonly status?: string }
    | undefined;
  if (metadata?.custom?.turnId || metadata?.status) return false;
  return message.status?.type === "running";
}

// eve creates its assistant row after delivery.consumed / model.started. Until
// then, keep a display-only row at that same position; it is never persisted.
// `awaitingReply` covers prepare + the gap after deliveryId clears localSend
// but before eve publishes an assistant, so Thinking does not blank mid-send.
export function withPendingAssistant(
  messages: readonly ThreadMessageLike[],
  source: readonly { role: string; metadata?: { status?: string } }[],
  streaming: boolean,
  awaitingReply = false,
): ThreadMessageLike[] {
  let next = messages as ThreadMessageLike[];
  const trailing = next[next.length - 1];
  if (
    isDisplayOnlyPendingAssistant(trailing) &&
    !streaming &&
    !awaitingReply
  ) {
    next = next.slice(0, -1);
  }
  // Preserve identity when the overlay is a no-op so external-store can skip
  // a full thread resync on stream ticks that only grow the last assistant.
  if (next[next.length - 1]?.role === "assistant") {
    return next;
  }
  const lastSource = source[source.length - 1];
  const streamReady =
    streaming
    && lastSource?.role === "user"
    && lastSource.metadata?.status === "complete";
  const preparingOptimistic =
    awaitingReply && next[next.length - 1]?.role === "user";
  if (!streamReady && !preparingOptimistic) {
    return next;
  }
  return [...next, { role: "assistant", content: [], status: { type: "running" } }];
}

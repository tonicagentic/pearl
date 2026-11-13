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
  if (messages[messages.length - 1]?.role === "assistant") {
    return [...messages];
  }
  const lastSource = source[source.length - 1];
  const streamReady =
    streaming
    && lastSource?.role === "user"
    && lastSource.metadata?.status === "complete";
  const preparingOptimistic =
    awaitingReply && messages[messages.length - 1]?.role === "user";
  if (!streamReady && !preparingOptimistic) {
    return [...messages];
  }
  return [...messages, { role: "assistant", content: [], status: { type: "running" } }];
}

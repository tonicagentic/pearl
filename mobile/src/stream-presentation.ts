import type { ThreadMessageLike } from "@assistant-ui/react-native";

// Use the remaining time in a short reveal window rather than a fixed number
// of characters per frame. A multi-kilobyte *live* delta still gets a paced
// reveal, but cannot strand the end of a reply for seconds after it settles.
export function nextRevealLength(
  text: string,
  from: number,
  elapsedMs: number,
  remainingMs = 260,
): number {
  if (from >= text.length) return text.length;
  const remaining = text.length - from;
  if (elapsedMs >= remainingMs || remaining > 32_768) return text.length;
  const budget = Math.max(1, Math.ceil(remaining * Math.max(0, elapsedMs) / remainingMs));
  let end = from;
  for (let i = 0; i < budget && end < text.length; i++) {
    end += (text.codePointAt(end) ?? 0) > 0xffff ? 2 : 1;
  }
  return end;
}

// eve creates its assistant row on step.started, after message.received. Until
// then, keep a display-only row at that same position; it is never persisted.
export function withPendingAssistant(
  messages: readonly ThreadMessageLike[],
  source: readonly { role: string; metadata?: { status?: string } }[],
  streaming: boolean,
): ThreadMessageLike[] {
  const lastSource = source[source.length - 1];
  if (!streaming || lastSource?.role !== "user" ||
      lastSource.metadata?.status !== "complete" ||
      messages[messages.length - 1]?.role === "assistant") {
    return [...messages];
  }
  return [...messages, { role: "assistant", content: [], status: { type: "running" } }];
}

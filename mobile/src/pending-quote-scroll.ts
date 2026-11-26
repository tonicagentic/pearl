/** Library → chat: scroll to the message a quote was saved from. */

type Pending = {
  readonly chatId: string;
  readonly messageId: string;
};

let pending: Pending | null = null;

export function setPendingQuoteScroll(next: Pending | null): void {
  pending = next;
}

/** Returns and clears the pending target when it matches `chatId`. */
export function takePendingQuoteScroll(chatId: string | null): string | null {
  if (!pending || !chatId || pending.chatId !== chatId) return null;
  const messageId = pending.messageId;
  pending = null;
  return messageId;
}

/** Last in-message text selection — used when the native Bookmark menu fires. */

export type ActiveQuoteSelection = {
  readonly text: string;
  readonly messageId: string;
  readonly chatId: string | null;
};

let active: ActiveQuoteSelection | null = null;

export function setActiveQuoteSelection(
  next: ActiveQuoteSelection | null,
): void {
  active = next;
}

export function getActiveQuoteSelection(): ActiveQuoteSelection | null {
  return active;
}

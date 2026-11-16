/**
 * One-shot draft from the home composer into `/chat`. Cleared when the thread
 * consumes it so a later revisit does not resend.
 */
let pendingDraft: string | null = null;

export function setComposeHandoff(text: string) {
  const trimmed = text.trim();
  pendingDraft = trimmed.length > 0 ? trimmed : null;
}

export function takeComposeHandoff(): string | null {
  const next = pendingDraft;
  pendingDraft = null;
  return next;
}

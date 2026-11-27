import {
  isTextOnlyPendingQuestion,
  type PendingApproval,
} from "./message-projection";

/**
 * Free-text ask_question parks answer through the normal composer. While the
 * turn stays open the composer would otherwise show Stop; prefer Send once
 * the user has typed a reply.
 */
export function preferSendOnTextReplyPark(input: {
  readonly textReplyPending: boolean;
  readonly composerEmpty: boolean;
  readonly canSend: boolean;
}): boolean {
  return (
    input.textReplyPending && !input.composerEmpty && input.canSend
  );
}

/**
 * Oldest open text-only question. `getPendingApprovals` is newest-first, so
 * the last text-only entry is the first the person should answer.
 */
export function oldestTextOnlyQuestion(
  pending: readonly PendingApproval[],
): PendingApproval | null {
  const texts = pending.filter(isTextOnlyPendingQuestion);
  if (texts.length === 0) return null;
  return texts[texts.length - 1] ?? null;
}

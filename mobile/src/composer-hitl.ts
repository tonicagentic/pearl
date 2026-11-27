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

/** True when composer Send should settle the open text ask via `answers`. */
export function shouldSendTextReplyAnswer(input: {
  readonly onlyTextQuestionsPending: boolean;
  readonly hasAttachments: boolean;
  readonly text: string;
}): boolean {
  return (
    input.onlyTextQuestionsPending &&
    !input.hasAttachments &&
    input.text.trim().length > 0
  );
}

/** Payload for `store.send` when answering a text-only park from the composer. */
export function buildTextReplyAnswerPayload(
  pending: PendingApproval,
  text: string,
): {
  readonly answers: readonly [
    { readonly interactionId: string; readonly text: string },
  ];
} {
  return {
    answers: [
      {
        interactionId: pending.requestId,
        text: text.trim(),
      },
    ],
  };
}

/**
 * Composer trailing control: Send/Live vs Cancel while a turn may still be
 * marked running (paused HITL).
 */
export function resolveComposerTrailingMode(input: {
  readonly textReplyPending: boolean;
  readonly composerEmpty: boolean;
  readonly canSend: boolean;
  readonly isRunning: boolean;
  readonly hasVoice: boolean;
  readonly hasSubmission: boolean;
}): {
  readonly showSendOrLive: boolean;
  readonly showCancel: boolean;
} {
  const preferSendWhileRunning = preferSendOnTextReplyPark({
    textReplyPending: input.textReplyPending,
    composerEmpty: input.composerEmpty,
    canSend: input.canSend,
  });
  const showSendOrLive =
    !input.hasSubmission &&
    (!input.isRunning || input.hasVoice || preferSendWhileRunning);
  return {
    showSendOrLive,
    showCancel: !showSendOrLive,
  };
}

import {
  buildTextReplyAnswerPayload,
  oldestTextOnlyQuestion,
  preferSendOnTextReplyPark,
  resolveComposerTrailingMode,
  shouldSendTextReplyAnswer,
} from "../src/composer-hitl";
import type { PendingApproval } from "../src/message-projection";

const textAsk = (id: string): PendingApproval => ({
  requestId: id,
  toolName: "ask_question",
  kind: "question",
  display: "text",
  prompt: "Which project?",
  options: [],
  allowFreeform: true,
});

const choiceAsk = (id: string): PendingApproval => ({
  requestId: id,
  toolName: "ask_question",
  kind: "question",
  display: "select",
  prompt: "Pick one",
  options: [
    { id: "a", label: "A" },
    { id: "b", label: "B" },
  ],
  allowFreeform: true,
});

describe("preferSendOnTextReplyPark", () => {
  it("shows send when a text-reply park has a sendable draft", () => {
    expect(
      preferSendOnTextReplyPark({
        textReplyPending: true,
        composerEmpty: false,
        canSend: true,
      }),
    ).toBe(true);
  });

  it("keeps stop when the draft is empty", () => {
    expect(
      preferSendOnTextReplyPark({
        textReplyPending: true,
        composerEmpty: true,
        canSend: false,
      }),
    ).toBe(false);
  });

  it("does not force send outside a text-reply park", () => {
    expect(
      preferSendOnTextReplyPark({
        textReplyPending: false,
        composerEmpty: false,
        canSend: true,
      }),
    ).toBe(false);
  });
});

describe("oldestTextOnlyQuestion", () => {
  it("returns the oldest text ask from a newest-first list", () => {
    const pending = [textAsk("new"), textAsk("old")];
    expect(oldestTextOnlyQuestion(pending)?.requestId).toBe("old");
  });

  it("ignores choice questions", () => {
    expect(oldestTextOnlyQuestion([choiceAsk("q")])).toBeNull();
  });
});

describe("shouldSendTextReplyAnswer", () => {
  it("routes typed text on a text-only park", () => {
    expect(
      shouldSendTextReplyAnswer({
        onlyTextQuestionsPending: true,
        hasAttachments: false,
        text: "Music EP",
      }),
    ).toBe(true);
  });

  it("does not route empty drafts or attachments", () => {
    expect(
      shouldSendTextReplyAnswer({
        onlyTextQuestionsPending: true,
        hasAttachments: false,
        text: "   ",
      }),
    ).toBe(false);
    expect(
      shouldSendTextReplyAnswer({
        onlyTextQuestionsPending: true,
        hasAttachments: true,
        text: "Music EP",
      }),
    ).toBe(false);
  });

  it("does not route when choice / approval parks are open", () => {
    expect(
      shouldSendTextReplyAnswer({
        onlyTextQuestionsPending: false,
        hasAttachments: false,
        text: "Music EP",
      }),
    ).toBe(false);
  });
});

describe("buildTextReplyAnswerPayload", () => {
  it("builds answers with interactionId and trimmed text", () => {
    expect(buildTextReplyAnswerPayload(textAsk("q1"), "  Music EP  ")).toEqual({
      answers: [{ interactionId: "q1", text: "Music EP" }],
    });
  });
});

describe("resolveComposerTrailingMode", () => {
  it("shows cancel when running with an empty draft on a text park", () => {
    expect(
      resolveComposerTrailingMode({
        textReplyPending: true,
        composerEmpty: true,
        canSend: false,
        isRunning: true,
        hasVoice: false,
        hasSubmission: false,
      }),
    ).toEqual({ showSendOrLive: false, showCancel: true });
  });

  it("shows send when running with a typed draft on a text park", () => {
    expect(
      resolveComposerTrailingMode({
        textReplyPending: true,
        composerEmpty: false,
        canSend: true,
        isRunning: true,
        hasVoice: false,
        hasSubmission: false,
      }),
    ).toEqual({ showSendOrLive: true, showCancel: false });
  });

  it("keeps cancel while running outside a text-reply park", () => {
    expect(
      resolveComposerTrailingMode({
        textReplyPending: false,
        composerEmpty: false,
        canSend: true,
        isRunning: true,
        hasVoice: false,
        hasSubmission: false,
      }),
    ).toEqual({ showSendOrLive: false, showCancel: true });
  });
});

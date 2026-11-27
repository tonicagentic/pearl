import {
  oldestTextOnlyQuestion,
  preferSendOnTextReplyPark,
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

import {
  hasComposerOpenQuestion,
  hasOpenQuestion,
  type AssistantMessagePart,
} from "../src/assistant-blocks";

describe("assistant-blocks HITL question helpers", () => {
  const textOnlyAsk: AssistantMessagePart = {
    type: "tool-call",
    toolCallId: "ask_1",
    toolName: "ask_question",
    args: { question: "Which project should this EP goal belong to?" },
    argsText: "{}",
    status: { type: "requires-action", reason: "tool-calls" },
    approval: {
      id: "text-q1",
      prompt: "Which project should this EP goal belong to?",
      display: "text",
      allowFreeform: true,
    },
  };

  const choiceAsk: AssistantMessagePart = {
    type: "tool-call",
    toolCallId: "ask_2",
    toolName: "ask_question",
    args: {
      question: "Pick a lane",
      options: [
        { label: "A", description: "First" },
        { label: "B", description: "Second" },
      ],
    },
    argsText: "{}",
    status: { type: "requires-action", reason: "tool-calls" },
    approval: {
      id: "choice-q1",
      prompt: "Pick a lane",
      display: "select",
      options: [
        { id: "A", kind: "_A", label: "A" },
        { id: "B", kind: "_B", label: "B" },
      ],
    },
  };

  it("treats text-only ask_question as open but not composer-morphing", () => {
    const parts = [textOnlyAsk];
    expect(hasOpenQuestion(parts)).toBe(true);
    expect(hasComposerOpenQuestion(parts)).toBe(false);
  });

  it("treats select ask_question as composer-morphing", () => {
    const parts = [choiceAsk];
    expect(hasOpenQuestion(parts)).toBe(true);
    expect(hasComposerOpenQuestion(parts)).toBe(true);
  });

  it("ignores settled approvals without an open question", () => {
    const parts: AssistantMessagePart[] = [
      {
        type: "tool-call",
        toolCallId: "tool_1",
        toolName: "create_goal",
        args: {},
        argsText: "{}",
        status: { type: "complete" },
        approval: {
          id: "appr_1",
          prompt: "Create goal?",
          display: "decision",
          approved: true,
        },
      },
    ];
    expect(hasOpenQuestion(parts)).toBe(false);
    expect(hasComposerOpenQuestion(parts)).toBe(false);
  });
});

import type { EveMessage } from "eve/client";

import {
  composerWaitingQuestions,
  getPendingApprovals,
  hasPendingAction,
  isChoicePendingQuestion,
  isTextOnlyPendingQuestion,
  pendingWaitKind,
  pendingForToolCall,
} from "../src/message-projection";

function assistant(parts: EveMessage["parts"], status: "complete" | "streaming" | "failed" = "complete"): EveMessage {
  return {
    id: `msg-${Math.random().toString(36).slice(2)}`,
    role: "assistant",
    metadata: { status, turnId: "turn_0" },
    parts,
  };
}

describe("pending approvals across the thread", () => {
  test("finds an approval on an earlier coder call while a later coder is still running", () => {
    const earlier = assistant([
      {
        type: "tool",
        callId: "call_first_coder",
        name: "coder",
        label: "coder",
        kind: "agent",
        stepIndex: 0,
        state: "completed",
        output: "plan ready",
        interaction: {
          interactionId: "Tq7ObdSW833S7spV",
          turnId: "turn_0",
          stepIndex: 0,
          status: "open",
          request: {
            kind: "approval",
            prompt: "Approve Expo simulator?",
            display: "confirmation",
            options: [
              { id: "approve", label: "Approve" },
              { id: "deny", label: "Deny" },
            ],
            allowFreeform: false,
          },
          call: {
            callId: "call_expo",
            name: "expo__simulator_start",
            input: {
              appFullName: "@tonicagentic/pearl",
              appId: "43ee6005-c5ac-4b8f-b463-5d910681956d",
            },
          },
        },
      },
    ]);
    const later = assistant(
      [
        {
          type: "text",
          text: "I'll implement the approved scope.",
          state: "done",
        },
        {
          type: "tool",
          callId: "call_second_coder",
          name: "coder",
          label: "coder",
          kind: "agent",
          stepIndex: 0,
          state: "running",
        },
      ],
      "streaming",
    );

    const data = { messages: [earlier, later] };
    expect(hasPendingAction(data)).toBe(true);
    expect(pendingWaitKind(data)).toBe("approval");
    const pending = getPendingApprovals(data);
    expect(pending).toHaveLength(1);
    expect(pending[0]?.requestId).toBe("Tq7ObdSW833S7spV");
    expect(pending[0]?.prompt).toMatch(/Expo simulator/i);
    expect(pending[0]?.toolName).toBe("expo__simulator_start");
    expect(pending[0]?.detail).toMatch(/@tonicagentic\/pearl/);
    expect(pendingForToolCall(data, "call_first_coder")?.requestId).toBe(
      "Tq7ObdSW833S7spV",
    );
  });

  test("includes an open question and skips settled interactions", () => {
    const message = assistant([
      {
        type: "interaction",
        interactionId: "q1",
        turnId: "turn_0",
        stepIndex: 0,
        status: "open",
        request: {
          kind: "question",
          prompt: "Which repo?",
          display: "select",
          options: [
            { id: "a", label: "pearl" },
            { id: "b", label: "my-agent" },
          ],
        },
      },
      {
        type: "interaction",
        interactionId: "settled-1",
        turnId: "turn_0",
        stepIndex: 1,
        status: "settled",
        outcome: "accepted",
        request: {
          kind: "approval",
          prompt: "Already done",
          display: "confirmation",
          options: [
            { id: "approve", label: "Approve" },
            { id: "deny", label: "Deny" },
          ],
        },
      },
    ]);

    const pending = getPendingApprovals({ messages: [message] });
    expect(pending).toHaveLength(1);
    expect(pending[0]?.kind).toBe("question");
    expect(pendingWaitKind({ messages: [message] })).toBe("question");
  });

  test("reads a child-only approval from a followed agent conversation", () => {
    const parent = assistant([
      {
        type: "text",
        text: "Working on it.",
        state: "done",
      },
      {
        type: "tool",
        callId: "call_parent_coder",
        name: "coder",
        label: "coder",
        kind: "agent",
        stepIndex: 0,
        state: "running",
      },
    ], "streaming");

    const childMessage = assistant([
      {
        type: "tool",
        callId: "call_expo",
        name: "expo__simulator_start",
        label: "simulator_start",
        kind: "action",
        stepIndex: 0,
        state: "running",
        interaction: {
          interactionId: "child-approval",
          turnId: "turn_child",
          stepIndex: 0,
          status: "open",
          request: {
            kind: "approval",
            prompt: "Approve Expo simulator?",
            display: "confirmation",
            options: [
              { id: "approve", label: "Approve" },
              { id: "deny", label: "Deny" },
            ],
          },
        },
      },
    ], "streaming");

    const data = {
      messages: [parent],
      agents: {
        wrun_child: {
          sessionId: "wrun_child",
          name: "coder",
          owner: { callId: "call_parent_coder" },
          callId: "call_parent_coder",
          observation: {
            status: "following" as const,
            conversation: {
              view: {} as never,
              messages: [childMessage],
              agents: {},
            },
            position: 1,
            caughtUp: false,
          },
        },
      },
    };

    expect(hasPendingAction(data)).toBe(true);
    const pending = getPendingApprovals(data);
    expect(pending).toHaveLength(1);
    expect(pending[0]?.requestId).toBe("child-approval");
    expect(pending[0]?.toolName).toBe("expo__simulator_start");
  });

  test("dedupes the same interaction id across parent and child", () => {
    const shared = {
      interactionId: "shared-id",
      turnId: "turn_0",
      stepIndex: 0,
      status: "open" as const,
      request: {
        kind: "approval" as const,
        prompt: "Approve?",
        display: "confirmation" as const,
        options: [
          { id: "approve", label: "Approve" },
          { id: "deny", label: "Deny" },
        ],
      },
    };
    const parent = assistant([
      {
        type: "tool",
        callId: "call_coder",
        name: "coder",
        label: "coder",
        kind: "agent",
        stepIndex: 0,
        state: "completed",
        output: "ok",
        interaction: shared,
      },
    ]);
    const child = assistant([
      {
        type: "interaction",
        ...shared,
      },
    ]);

    const pending = getPendingApprovals({
      messages: [parent],
      agents: {
        child: {
          sessionId: "child",
          name: "coder",
          owner: { callId: "call_coder" },
          callId: "call_coder",
          observation: {
            status: "caught-up",
            conversation: {
              view: {} as never,
              messages: [child],
              agents: {},
            },
            position: 2,
            caughtUp: true,
          },
        },
      },
    });
    expect(pending).toHaveLength(1);
    expect(pending[0]?.requestId).toBe("shared-id");
  });

  test("failed assistant turns do not block sending", () => {
    const failed = assistant(
      [
        {
          type: "interaction",
          interactionId: "open-on-failed",
          turnId: "turn_0",
          stepIndex: 0,
          status: "open",
          request: {
            kind: "approval",
            prompt: "Approve?",
            display: "confirmation",
            options: [
              { id: "approve", label: "Approve" },
              { id: "deny", label: "Deny" },
            ],
          },
        },
      ],
      "failed",
    );
    expect(hasPendingAction({ messages: [failed] })).toBe(false);
    expect(getPendingApprovals({ messages: [failed] })).toEqual([]);
  });

  test("ignores open child authorization when the parent coder was cancelled", () => {
    const parent = assistant([
      {
        type: "tool",
        callId: "call_dead_coder",
        name: "coder",
        label: "coder",
        kind: "agent",
        stepIndex: 0,
        state: "cancelled",
      },
    ]);
    const childAssistant = assistant([
      {
        type: "interaction",
        interactionId: "child-auth",
        turnId: "turn_child",
        stepIndex: 0,
        status: "open",
        request: {
          kind: "sign-in",
          prompt: "Sign in to GitHub",
          title: "GitHub",
          signIn: { name: "github", url: "https://example.test/auth" },
        },
      },
    ]);
    const data = {
      messages: [parent],
      agents: {
        child: {
          sessionId: "sess_child",
          name: "coder",
          callId: "call_dead_coder",
          owner: { callId: "call_dead_coder" },
          observation: {
            status: "following" as const,
            conversation: { messages: [childAssistant], view: {} as never },
            position: 1,
            caughtUp: false,
          },
        },
      },
    };
    expect(hasPendingAction(data)).toBe(false);
    expect(pendingWaitKind(data)).toBe(null);
  });

  test("text-only ask_question parks the turn without morphing the composer", () => {
    const message = assistant([
      {
        type: "interaction",
        interactionId: "text-q1",
        turnId: "turn_0",
        stepIndex: 0,
        status: "open",
        request: {
          kind: "question",
          prompt: "Which project should this EP goal belong to?",
          display: "text",
          allowFreeform: true,
        },
      },
    ]);
    const data = { messages: [message] };
    expect(hasPendingAction(data)).toBe(true);
    // Choice questions own "question" wait chrome; text-only stays in composer.
    expect(pendingWaitKind(data)).toBe(null);

    const pending = getPendingApprovals(data);
    expect(pending).toHaveLength(1);
    expect(pending[0]?.display).toBe("text");
    expect(isTextOnlyPendingQuestion(pending[0]!)).toBe(true);
    expect(isChoicePendingQuestion(pending[0]!)).toBe(false);
    expect(composerWaitingQuestions(pending)).toEqual([]);
  });

  test("mixed choice + text asks morph via composerWaitingQuestions", () => {
    const message = assistant([
      {
        type: "interaction",
        interactionId: "choice-q",
        turnId: "turn_0",
        stepIndex: 0,
        status: "open",
        request: {
          kind: "question",
          prompt: "Pick a lane",
          display: "select",
          options: [
            { id: "a", label: "A" },
            { id: "b", label: "B" },
          ],
        },
      },
      {
        type: "interaction",
        interactionId: "text-q",
        turnId: "turn_0",
        stepIndex: 1,
        status: "open",
        request: {
          kind: "question",
          prompt: "Anything else?",
          display: "text",
          allowFreeform: true,
        },
      },
    ]);
    const pending = getPendingApprovals({ messages: [message] });
    expect(pendingWaitKind({ messages: [message] })).toBe("question");
    expect(composerWaitingQuestions(pending).map((item) => item.requestId)).toEqual(
      ["choice-q", "text-q"],
    );
  });
});

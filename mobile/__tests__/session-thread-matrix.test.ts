/**
 * Session / thread state matrix for the Pearl mobile eve client.
 * Pure helpers + fakes — no Metro / SessionStore network.
 */
import { emptySessionView } from "eve/events";
import type { EveMessage } from "eve/client";
import { mobileFollowWhile } from "../src/chat/follow-policy";
import {
  ensureObservation,
  releaseObservation,
  syncObservationToView,
} from "../src/chat/observe-lifecycle";
import { resolveTurnPolicy } from "../src/chat/prepare-send";
import {
  deriveTurnRunning,
  isZombieBusy,
} from "../src/chat/turn-running";
import {
  hasPendingAction,
  getPendingApprovals,
} from "../src/message-projection";
import { reconnectSession } from "../src/chat/session-reconnect";
import {
  flushCatchUpHold,
  routeCatchUpDelta,
  shouldClearCatchUpOnEvent,
} from "../src/chat/catch-up";

function assistant(
  status: "streaming" | "complete",
  tools: readonly { name: string; state: string }[] = [],
  extras: Partial<EveMessage> = {},
): EveMessage {
  return {
    role: "assistant",
    metadata: { status },
    parts: [
      ...tools.map((tool, i) => ({
        type: "tool" as const,
        name: tool.name,
        state: tool.state,
        callId: `call_${i}`,
      })),
      { type: "text" as const, text: "hi" },
    ],
    ...extras,
  } as EveMessage;
}

describe("session/thread matrix", () => {
  it("idle empty: composer running false, followWhile false", () => {
    const view = emptySessionView();
    expect(mobileFollowWhile(view)).toBe(false);
    expect(
      deriveTurnRunning({ status: "idle", messages: [], view }),
    ).toBe(false);
  });

  it("resuming: Stop false (catch-up is not live generation)", () => {
    expect(
      deriveTurnRunning({
        status: "resuming",
        messages: [assistant("complete")],
        view: emptySessionView(),
      }),
    ).toBe(false);
  });

  it("busy + streaming assistant: running", () => {
    expect(
      deriveTurnRunning({
        status: "busy",
        messages: [assistant("streaming")],
        view: emptySessionView(),
      }),
    ).toBe(true);
  });

  it("busy + settled cancelled tools: zombie, not running, no cancel needed", () => {
    const messages = [
      assistant("complete", [{ name: "coder", state: "cancelled" }]),
    ];
    expect(
      deriveTurnRunning({
        status: "busy",
        messages,
        view: emptySessionView(),
      }),
    ).toBe(false);
    expect(
      isZombieBusy({
        status: "busy",
        messages,
        view: emptySessionView(),
      }),
    ).toBe(true);
    expect(mobileFollowWhile(emptySessionView())).toBe(false);
  });

  it("releases observation when parent turn is settled", () => {
    const binding = { stopObserving: null as (() => void) | null };
    let released = false;
    ensureObservation(binding, () => () => {
      released = true;
    });
    expect(
      syncObservationToView(binding, emptySessionView(), () => () => {}),
    ).toBe("released");
    expect(released).toBe(true);
    expect(binding.stopObserving).toBeNull();
  });

  it("HITL parent approval blocks via hasPendingAction", () => {
    const messages = [
      {
        role: "assistant",
        metadata: { status: "complete" },
        parts: [
          {
            type: "tool",
            name: "shell",
            state: "running",
            callId: "c1",
            interaction: {
              status: "open",
              interactionId: "i1",
              request: {
                kind: "approval",
                prompt: "Run?",
                options: [
                  { id: "approve", label: "Approve" },
                  { id: "deny", label: "Deny" },
                ],
              },
            },
          },
        ],
      } as EveMessage,
    ];
    expect(hasPendingAction({ messages })).toBe(true);
    expect(getPendingApprovals({ messages }).length).toBeGreaterThan(0);
  });

  it("dead parent tool skips child HITL for composer", () => {
    const parent = assistant("complete", [
      { name: "coder", state: "cancelled" },
    ]);
    const childMessages = [
      {
        role: "assistant",
        metadata: { status: "complete" },
        parts: [
          {
            type: "tool",
            name: "shell",
            state: "running",
            callId: "child_call",
            interaction: {
              status: "open",
              interactionId: "ci1",
              request: {
                kind: "approval",
                prompt: "Child?",
                options: [{ id: "approve", label: "Yes" }],
              },
            },
          },
        ],
      } as EveMessage,
    ];
    const agents = {
      child_sess: {
        name: "coder",
        callId: "call_0",
        sessionId: "child_sess",
        owner: { callId: "call_0" },
        observation: {
          status: "caught-up" as const,
          conversation: { messages: childMessages },
        },
      },
    };
    // Parent tool cancelled — child open approval must not block.
    expect(
      hasPendingAction({
        messages: [parent],
        agents: agents as never,
      }),
    ).toBe(false);
  });

  it("cancelled settle clears catch-up hold; idle drops held deltas", () => {
    expect(
      shouldClearCatchUpOnEvent({
        type: "turn.settled",
        outcome: "cancelled",
      }),
    ).toBe(true);
    expect(
      flushCatchUpHold({
        status: "idle",
        held: [{ turnId: "t", partId: "p", kind: "text", delta: "x" }],
      }).kind,
    ).toBe("drop");
    expect(
      flushCatchUpHold({
        status: "busy",
        held: [{ turnId: "t", partId: "p", kind: "text", delta: "x" }],
      }).kind,
    ).toBe("seed");
  });

  it("resuming holds content deltas", () => {
    expect(
      routeCatchUpDelta({ status: "resuming", kind: "text" }).kind,
    ).toBe("hold");
    expect(
      routeCatchUpDelta({ status: "busy", kind: "text" }).kind,
    ).toBe("push");
  });

  it("queue policy only when turn open", () => {
    expect(
      resolveTurnPolicy({ queueEnabled: true, turnOpen: true }),
    ).toBe("queue");
  });

  it("reconnect leaves a live turn alone (no cancel)", async () => {
    const calls: string[] = [];
    const store = {
      snapshot: {
        status: "busy" as const,
        session: { sessionId: "s1", streamIndex: 1 },
        messages: [assistant("streaming")],
        events: [] as const,
        view: emptySessionView(),
      },
      resume: async () => {
        calls.push("resume");
      },
      cancel: async () => {
        calls.push("cancel");
        throw new Error("should not cancel");
      },
    };
    const result = await reconnectSession(store as never, { backoffMs: [] });
    expect(result.ok).toBe(true);
    expect(calls).toEqual(["resume"]);
  });

  it("ensureObservation is idempotent", () => {
    const binding = { stopObserving: null as (() => void) | null };
    let created = 0;
    const observe = () => {
      created += 1;
      return () => {};
    };
    ensureObservation(binding, observe);
    ensureObservation(binding, observe);
    expect(created).toBe(1);
    releaseObservation(binding);
  });
});

import { emptySessionView } from "eve/events";
import {
  mobileFollowWhile,
  shouldHoldObservation,
} from "../src/chat/follow-policy";
import {
  ensureObservation,
  releaseObservation,
  syncObservationToView,
} from "../src/chat/observe-lifecycle";
import {
  enrichPrepareSendPayload,
  resolveTurnPolicy,
} from "../src/chat/prepare-send";
import { formatEveClientError } from "../src/chat/eve-error";
import {
  deriveTurnRunning,
  isZombieBusy,
} from "../src/chat/turn-running";
import type { EveMessage } from "eve/client";

describe("follow-policy", () => {
  it("does not follow an empty idle view", () => {
    const view = emptySessionView();
    expect(mobileFollowWhile(view)).toBe(false);
    expect(shouldHoldObservation(view)).toBe(false);
  });
});

describe("observe-lifecycle", () => {
  it("ensure then release clears the stop handle", () => {
    const binding = { stopObserving: null as (() => void) | null };
    let stopped = false;
    ensureObservation(binding, () => () => {
      stopped = true;
    });
    expect(binding.stopObserving).not.toBeNull();
    releaseObservation(binding);
    expect(binding.stopObserving).toBeNull();
    expect(stopped).toBe(true);
  });

  it("syncObservationToView releases when followWhile is false", () => {
    const binding = { stopObserving: null as (() => void) | null };
    ensureObservation(binding, () => () => {});
    const result = syncObservationToView(
      binding,
      emptySessionView(),
      () => () => {},
    );
    expect(result).toBe("released");
    expect(binding.stopObserving).toBeNull();
  });
});

describe("prepare-send", () => {
  it("resolveTurnPolicy queues only when turn is open and queue enabled", () => {
    expect(
      resolveTurnPolicy({ queueEnabled: true, turnOpen: true }),
    ).toBe("queue");
    expect(
      resolveTurnPolicy({ queueEnabled: true, turnOpen: false }),
    ).toBeUndefined();
    expect(
      resolveTurnPolicy({ queueEnabled: false, turnOpen: true }),
    ).toBeUndefined();
  });

  it("enrichPrepareSendPayload attaches clientContext and rejects limits", async () => {
    const ok = await enrichPrepareSendPayload(
      { message: "hello" },
      {
        checkSendLimit: async () => ({ allowed: true }),
        projectId: "p1",
        chatId: "c1",
        customAgentId: null,
      },
    );
    expect(ok.message).toBe("hello");
    expect(ok.clientContext).toMatchObject({ eveChatId: "c1" });

    await expect(
      enrichPrepareSendPayload(
        { message: "nope" },
        {
          checkSendLimit: async () => ({
            allowed: false,
            message: "Too many",
            retryAfter: 12,
          }),
          projectId: null,
          chatId: null,
          customAgentId: null,
        },
      ),
    ).rejects.toThrow(/Too many.*12/);
  });
});

describe("eve-error", () => {
  it("prefers send then connection then store", () => {
    expect(
      formatEveClientError({
        sendError: "send failed",
        connectionError: "lost",
        storeError: new Error("store"),
      }),
    ).toBe("send failed");
    expect(
      formatEveClientError({
        connectionError: "lost",
        storeError: new Error("store"),
      }),
    ).toBe("lost");
    expect(
      formatEveClientError({ storeError: new Error("store boom") }),
    ).toBe("store boom");
  });
});

describe("deriveTurnRunning with view", () => {
  const complete = {
    role: "assistant",
    metadata: { status: "complete" },
    parts: [
      { type: "tool", name: "coder", state: "cancelled", callId: "c1" },
      { type: "text", text: "done" },
    ],
  } as EveMessage;

  it("is not running for zombie busy without activeTurn", () => {
    expect(
      deriveTurnRunning({
        status: "busy",
        messages: [complete],
        view: emptySessionView(),
      }),
    ).toBe(false);
    expect(
      isZombieBusy({
        status: "busy",
        messages: [complete],
        view: emptySessionView(),
      }),
    ).toBe(true);
  });
});

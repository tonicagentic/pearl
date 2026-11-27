import { act, renderHook } from "@testing-library/react-native";
import type { SessionStore, SessionStoreSnapshot } from "eve/client";
import { useExpectedReplies } from "../src/chat/use-expected-replies";
import { classifyThreadNotice } from "../src/chat/thread-notice";

// Hook wiring uses fake observations; tests/empty-turn.test.ts exercises the
// same cases against actual eve SessionStore folds and reconnect snapshots.
jest.mock("eve/events", () => ({
  delivery: (view: any, id: string) => view.deliveries[id],
  turn: (view: any, id: string) => view.turns[id],
  activeTurn: (view: any) => Object.values(view.turns).find((turn: any) => turn.status !== "settled"),
  session: (view: any) => view.session,
}));

function snapshot(states: Record<string, "queued" | "running" | "empty" | "answered">, status = "idle") {
  return {
    session: { sessionId: "session", streamIndex: 1 },
    status,
    events: [],
    messages: Object.entries(states).flatMap(([id, state]) => state === "answered" ? [{
      role: "assistant", metadata: { turnId: id }, parts: [{ type: "text", text: "answer" }],
    }] : []),
    view: {
      session: { status: "active" },
      deliveries: Object.fromEntries(Object.entries(states).map(([id, state]) => [id, {
        status: state === "queued" ? "admitted" : "consumed",
        ...(state === "queued" ? {} : { turnId: id }),
      }])),
      turns: Object.fromEntries(Object.entries(states).filter(([, state]) => state !== "queued").map(([id, state]) => [id, {
        turnId: id, status: state === "running" ? "running" : "settled", outcome: "completed",
      }])),
    },
  } as unknown as SessionStoreSnapshot;
}
const receipt = (deliveryId: string) => ({ sessionId: "session", deliveryId });

it("keeps queued expectations independent and releases only matching late output", async () => {
  const source = { snapshot: snapshot({ first: "running" }) } as SessionStore;
  const first = {};
  const second = {};
  const { result, rerender } = await renderHook(
    ({ current }) => useExpectedReplies(source, current),
    { initialProps: { current: source.snapshot } },
  );
  await act(() => {
    result.current.begin(source, first);
    result.current.accept(source, first, receipt("first"));
    result.current.begin(source, second);
    result.current.accept(source, second, receipt("second"));
  });
  expect(result.current.expectingAssistant).toBe(true);
  expect(result.current.emptyReplyError).toBeNull();
  await rerender({ current: snapshot({ first: "answered", second: "queued" }) });
  expect(result.current.expectingAssistant).toBe(true);
  expect(result.current.emptyReplyError).toBeNull();
  await rerender({ current: snapshot({ first: "answered", second: "running" }, "resuming") });
  expect(result.current.emptyReplyError).toBeNull();
  await rerender({ current: snapshot({ first: "answered", second: "empty" }) });
  expect(result.current.expectingAssistant).toBe(false);
  expect(result.current.emptyReplyError).toContain("didn't return");
  await rerender({ current: snapshot({ first: "answered", second: "answered" }) });
  expect(result.current.emptyReplyError).toBeNull();
});

it("late replies do not clear unrelated send or persistence errors", async () => {
  const source = { snapshot: snapshot({ first: "empty" }) } as SessionStore;
  const key = {};
  const { result, rerender } = await renderHook(
    ({ current }) => useExpectedReplies(source, current),
    { initialProps: { current: source.snapshot } },
  );
  await act(() => {
    result.current.begin(source, key);
    result.current.accept(source, key, receipt("first"));
  });
  expect(result.current.emptyReplyError).not.toBeNull();
  await rerender({ current: snapshot({ first: "answered" }) });
  const base = {
    offline: false, connectionError: null, persistenceError: null,
    sendError: "A different send failed", canResend: false, sendPreparing: false,
    pendingMessage: null, hasLocalSend: false, hasLoadedHistory: true,
    showReplyInterrupted: false, unifiedEveError: null,
  };
  expect(classifyThreadNotice({ ...base, sendError: base.sendError ?? result.current.emptyReplyError }))
    .toMatchObject({ kind: "error", detail: "A different send failed" });
  expect(classifyThreadNotice({ ...base, persistenceError: "Save failed" }))
    .toMatchObject({ kind: "error", title: "Could not save this chat." });
});

it("a failed send cannot erase another queued expectation or revive itself with a late receipt", async () => {
  const source = { snapshot: snapshot({ queued: "queued" }) } as SessionStore;
  const queued = {};
  const failed = {};
  const { result } = await renderHook(() => useExpectedReplies(source, source.snapshot));
  await act(() => {
    result.current.begin(source, queued);
    result.current.accept(source, queued, receipt("queued"));
    result.current.begin(source, failed);
    result.current.forget(source, failed);
    result.current.accept(source, failed, receipt("failed"));
  });
  expect(result.current.expectingAssistant).toBe(true);
  await act(() => result.current.forget(source, queued));
  expect(result.current.expectingAssistant).toBe(false);
  expect(result.current.emptyReplyError).toBeNull();
});

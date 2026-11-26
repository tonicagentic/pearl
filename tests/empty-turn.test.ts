import assert from "node:assert/strict";
import { test } from "node:test";
import { SessionStore, type SessionStreamEvent, type SessionStoreSnapshot } from "eve/client";
import { activeTurn, delivery, session, turn } from "eve/events";

import { expectedReplyState as classifyReply, type ExpectedReply } from "../lib/chat/empty-turn.ts";

function expectedReplyState(snapshot: SessionStoreSnapshot, receipt: ExpectedReply | undefined) {
  const received = receipt ? delivery(snapshot.view, receipt.deliveryId) : undefined;
  return classifyReply({
    ...snapshot,
    received,
    expectedTurn: received?.turnId ? turn(snapshot.view, received.turnId) : undefined,
    hasOpenTurn: activeTurn(snapshot.view) !== undefined,
    sessionEnded: session(snapshot.view).status === "ended",
  }, receipt);
}

type RawEvent = Omit<SessionStreamEvent, "meta">;
const receipt = (deliveryId: string) => ({ sessionId: "session", deliveryId });
const event = (type: string, data: object, turnId?: string): RawEvent =>
  ({ type, data, ...(turnId ? { scope: { turnId } } : {}) }) as RawEvent;
const start = (id: string, follows: string | null = null) => [
  event("delivery.admitted", { deliveryId: id }),
  event("delivery.consumed", {
    deliveryId: id, turnId: id, parts: [{ kind: "text", text: "question" }],
  }, id),
  event("turn.started", { turnId: id, cause: { deliveryId: id }, follows }, id),
];
const answer = (id: string) => [
  event("model.requested", { runId: `run-${id}`, owner: { turnId: id } }, id),
  event("content.completed", {
    partId: `part-${id}`, runId: `run-${id}`, kind: "text", phase: "reply", value: "answer",
  }, id),
  event("model.settled", { runId: `run-${id}`, outcome: "completed" }, id),
];
const settle = (id: string, outcome = "completed") => [
  event("turn.settled", { turnId: id, outcome }, id),
  event("delivery.settled", { deliveryId: id, turnId: id, outcome: "handled" }),
];
const history = [...start("old"), ...answer("old"), ...settle("old")];
function store(raws: readonly RawEvent[]) {
  const initialEvents = [event("session.started", {}), ...raws].map((raw, line) => ({
    ...raw,
    meta: { at: "2026-11-26T00:00:00.000Z", position: { line, index: 0 }, endOfLine: true },
  })) as SessionStreamEvent[];
  return new SessionStore({
    baseUrl: "https://unused.invalid",
    initialSession: { sessionId: "session", streamIndex: initialEvents.length },
    initialEvents,
  });
}

test("a prior settlement cannot finish the expected current delivery", () => {
  const snapshot = store([...history, ...start("current", "old")]).snapshot;
  assert.equal(activeTurn(snapshot.view)?.turnId, "current");
  assert.deepEqual(snapshot.messages.map((m) => m.role), ["user", "assistant", "user"]);
  assert.equal(expectedReplyState(snapshot, receipt("current")), "pending");
  assert.equal(expectedReplyState({ ...snapshot, status: "idle" }, receipt("current")), "pending");
});

test("real SessionStore resume preserves the open turn without an empty error", async (t) => {
  const source = store([...history, ...start("current", "old")]);
  t.mock.method(globalThis, "fetch", () => new Promise<Response>(() => {}));
  const resuming = source.resume();
  assert.equal(source.snapshot.status, "resuming");
  assert.equal(activeTurn(source.snapshot.view)?.turnId, "current");
  assert.equal(expectedReplyState(source.snapshot, receipt("current")), "pending");
  source.newSession();
  await assert.rejects(resuming, { name: "AbortError" });
});

test("only the expected successfully settled turn can be empty", () => {
  const snapshot = store([...history, ...start("current", "old"), ...settle("current")]).snapshot;
  assert.equal(expectedReplyState(snapshot, receipt("current")), "empty");
  assert.equal(expectedReplyState(snapshot, receipt("old")), "answered");
  assert.equal(expectedReplyState(snapshot, receipt("unknown")), "pending");
  assert.equal(expectedReplyState(snapshot, undefined), "pending");
  assert.equal(expectedReplyState({ ...snapshot, status: "resuming" }, receipt("current")), "pending");
  assert.equal(expectedReplyState({ ...snapshot, status: "busy" }, receipt("current")), "pending");
});

test("queued sends are independent of the previous answer and settlement", () => {
  const admitted = event("delivery.admitted", { deliveryId: "queued" });
  const queued = store([...history, admitted]).snapshot;
  assert.equal(expectedReplyState(queued, receipt("queued")), "pending");
  assert.equal(expectedReplyState(queued, receipt("old")), "answered");
  const open = store([...history, ...start("queued", "old")]).snapshot;
  assert.equal(expectedReplyState(open, receipt("queued")), "pending");
  const done = store([...history, ...start("queued", "old"), ...settle("queued")]).snapshot;
  assert.equal(expectedReplyState(done, receipt("queued")), "empty");
});

test("another open turn suppresses an empty notice while queued work runs", () => {
  const snapshot = store([
    ...start("first"), ...settle("first"), ...start("second", "first"),
  ]).snapshot;
  assert.equal(expectedReplyState(snapshot, receipt("first")), "pending");
  assert.equal(expectedReplyState(snapshot, receipt("second")), "pending");
});

test("matching late assistant output clears only its own empty classification", () => {
  const raws = [...start("first"), ...settle("first"), ...start("second", "first"), ...settle("second")];
  const before = store(raws).snapshot;
  assert.equal(expectedReplyState(before, receipt("first")), "empty");
  assert.equal(expectedReplyState(before, receipt("second")), "empty");
  const after = store([...raws, ...answer("first")]).snapshot;
  assert.equal(expectedReplyState(after, receipt("first")), "answered");
  assert.equal(expectedReplyState(after, receipt("second")), "empty");
});

test("tool-only output is assistant activity, not an empty reply", () => {
  const snapshot = store([
    ...start("tools"),
    event("model.requested", { runId: "run-tools", owner: { turnId: "tools" } }, "tools"),
    event("call.requested", {
      callId: "call", owner: { runId: "run-tools" }, capability: { kind: "tool", name: "search" }, input: {},
    }, "tools"),
    event("call.settled", { callId: "call", outcome: "completed", output: {} }, "tools"),
    ...settle("tools"),
  ]).snapshot;
  assert.ok(snapshot.messages.some((m) => m.role === "assistant" && m.parts.some((p) => p.type === "tool")));
  assert.equal(expectedReplyState(snapshot, receipt("tools")), "answered");
});

test("failed and cancelled turns do not masquerade as empty successful replies", () => {
  for (const outcome of ["failed", "cancelled"]) {
    const snapshot = store([...start("current"), ...settle("current", outcome)]).snapshot;
    assert.equal(expectedReplyState(snapshot, receipt("current")), "ended");
  }
});

test("session termination releases a receipt even without a turn settlement", () => {
  const snapshot = store([
    ...start("current"), event("session.ended", { outcome: "failed" }),
  ]).snapshot;
  assert.equal(expectedReplyState(snapshot, receipt("current")), "ended");
});

test("an empty assistant placeholder is not an answer", () => {
  const snapshot = store([
    ...start("current"),
    event("model.requested", { runId: "run-current", owner: { turnId: "current" } }, "current"),
    event("model.settled", { runId: "run-current", outcome: "completed" }, "current"),
    ...settle("current"),
  ]).snapshot;
  assert.equal(expectedReplyState(snapshot, receipt("current")), "empty");
});

test("receipts cannot leak across a replacement session", () => {
  const snapshot = store([...start("current"), ...settle("current")]).snapshot;
  assert.equal(expectedReplyState(snapshot, { sessionId: "different", deliveryId: "current" }), "ended");
});

test("an incomplete terminal line is not evidence of an empty reply", () => {
  const source = store(start("current"));
  const initialEvents = [...source.snapshot.events, {
    ...event("turn.settled", { turnId: "current", outcome: "completed" }, "current"),
    meta: { at: "2026-11-26T00:00:01.000Z", position: { line: 10, index: 0 }, endOfLine: false },
  }] as SessionStreamEvent[];
  const partial = new SessionStore({
    initialEvents,
    initialSession: { sessionId: "session", streamIndex: 10 },
  });
  assert.equal(expectedReplyState(partial.snapshot, receipt("current")), "pending");
});

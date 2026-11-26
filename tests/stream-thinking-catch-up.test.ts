import assert from "node:assert/strict";
import { test } from "node:test";
import { deriveLiveThinkingState } from "../lib/stream-thinking-state.ts";

const progressEvents = [
  {
    type: "call.requested",
    data: { callId: "c1" },
  },
  {
    type: "call.started",
    data: { callId: "c1" },
  },
  {
    type: "call.progress",
    data: { callId: "c1", label: "Searching the web…" },
  },
  {
    type: "call.input",
    data: { callId: "c1", delta: '{"q":"pearl"}', kind: "tool", name: "search" },
  },
] as const;

test("catchingUp suppresses tool/progress chrome during resume", () => {
  const live = deriveLiveThinkingState({
    events: [...progressEvents],
    parts: [],
    statusType: "running",
  });
  assert.equal(live.phase, "tool");
  assert.equal(live.label, "Searching the web…");

  const catchingUp = deriveLiveThinkingState({
    events: [...progressEvents],
    parts: [],
    statusType: "running",
    catchingUp: true,
  });
  assert.equal(catchingUp.phase, "idle");
  assert.equal(catchingUp.label, undefined);
});

test("catchingUp still yields to person-wait when requires-action", () => {
  const state = deriveLiveThinkingState({
    events: [],
    parts: [],
    statusType: "requires-action",
    personWaitLabel: "Needs your approval",
    catchingUp: true,
  });
  assert.equal(state.phase, "person-wait");
  assert.equal(state.label, "Needs your approval");
});

test("model.retried chrome is suppressed while catching up", () => {
  const events = [{ type: "model.retried", data: { runId: "r1", attempt: 1 } }];
  const live = deriveLiveThinkingState({
    events,
    parts: [],
    statusType: "running",
  });
  assert.equal(live.phase, "retry");

  const catchingUp = deriveLiveThinkingState({
    events,
    parts: [],
    statusType: "running",
    catchingUp: true,
  });
  assert.equal(catchingUp.phase, "idle");
  assert.equal(catchingUp.label, undefined);
});

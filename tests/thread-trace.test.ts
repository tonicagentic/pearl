import assert from "node:assert/strict";
import { test } from "node:test";

import {
  threadTraceFromEvents,
  type ThreadTraceEvent,
} from "../lib/usage/thread-trace.ts";

function event(
  type: string,
  data: ThreadTraceEvent["data"] = {},
  at = "2026-09-17T12:00:00.000Z",
): ThreadTraceEvent {
  return {
    type,
    data,
    meta: { at },
  };
}

test("threadTraceFromEvents returns empty totals with no model calls", () => {
  const trace = threadTraceFromEvents([
    event("message.received", { turnId: "t1", message: "hello" }),
  ]);

  assert.equal(trace.totals.modelCalls, 0);
  assert.equal(trace.totals.costUsd, null);
  assert.deepEqual(trace.callTurns, []);
  assert.equal(trace.turns, 0);
});

test("threadTraceFromEvents aggregates cost and groups calls by turn", () => {
  const trace = threadTraceFromEvents([
    event("message.received", {
      turnId: "t1",
      message: "Summarize the quarterly report for the board meeting",
    }),
    event("step.started", {
      turnId: "t1",
      stepIndex: 0,
      modelId: "zai/glm-5.3-flash",
    }),
    event("step.completed", {
      turnId: "t1",
      stepIndex: 0,
      usage: {
        costUsd: 0.02,
        inputTokens: 1000,
        outputTokens: 100,
        cacheReadTokens: 200,
      },
    }),
    event("step.started", {
      turnId: "t1",
      stepIndex: 1,
      modelId: "zai/glm-5.3-flash",
    }),
    event("step.completed", {
      turnId: "t1",
      stepIndex: 1,
      usage: {
        costUsd: 0.01,
        inputTokens: 500,
        outputTokens: 50,
      },
    }),
    event("message.received", { turnId: "t2", message: "thanks" }),
    event("step.started", {
      turnId: "t2",
      stepIndex: 0,
      modelId: "zai/glm-5.3-fast",
    }),
    event("step.completed", {
      turnId: "t2",
      stepIndex: 0,
      usage: {
        costUsd: 0.005,
        inputTokens: 200,
        outputTokens: 30,
      },
    }),
  ]);

  assert.equal(trace.totals.modelCalls, 3);
  assert.equal(trace.totals.inputTokens, 1700);
  assert.equal(trace.totals.outputTokens, 180);
  assert.equal(trace.totals.cacheReadTokens, 200);
  assert.ok(Math.abs((trace.totals.costUsd ?? 0) - 0.035) < 1e-9);
  assert.equal(trace.turns, 2);

  assert.deepEqual(
    trace.byModel.map((entry) => entry.label),
    ["zai/glm-5.3-flash", "zai/glm-5.3-fast"],
  );

  assert.equal(trace.callTurns.length, 2);
  assert.equal(
    trace.callTurns[0]?.label,
    "Summarize the quarterly report for the board meeting",
  );
  assert.equal(trace.callTurns[0]?.calls.length, 2);
  assert.equal(trace.callTurns[0]?.calls[0]?.modelId, "zai/glm-5.3-flash");
  assert.equal(trace.callTurns[1]?.label, "thanks");
  assert.equal(trace.callTurns[1]?.calls[0]?.modelId, "zai/glm-5.3-fast");
});

test("threadTraceFromEvents truncates long turn labels and falls back to Turn N", () => {
  const long = "x".repeat(100);
  const withLabel = threadTraceFromEvents([
    event("message.received", { turnId: "t1", message: long }),
    event("step.started", {
      turnId: "t1",
      stepIndex: 0,
      modelId: "m",
    }),
    event("step.completed", {
      turnId: "t1",
      stepIndex: 0,
      usage: { costUsd: 0.01 },
    }),
  ]);

  assert.ok(withLabel.callTurns[0]?.label.endsWith("…"));
  assert.ok((withLabel.callTurns[0]?.label.length ?? 0) <= 72);

  const withoutLabel = threadTraceFromEvents([
    event("step.started", {
      turnId: "t9",
      stepIndex: 0,
      modelId: "m",
    }),
    event("step.completed", {
      turnId: "t9",
      stepIndex: 0,
      usage: { costUsd: null },
    }),
  ]);

  assert.equal(withoutLabel.callTurns[0]?.label, "Turn 1");
  assert.equal(withoutLabel.totals.costUsd, null);
});

test("threadTraceFromEvents attributes each step to its started model", () => {
  const trace = threadTraceFromEvents([
    event("step.started", {
      turnId: "t1",
      stepIndex: 0,
      modelId: "model-a",
    }),
    event("step.started", {
      turnId: "t1",
      stepIndex: 1,
      modelId: "model-b",
    }),
    event("step.completed", {
      turnId: "t1",
      stepIndex: 0,
      usage: { costUsd: 0.1, inputTokens: 10, outputTokens: 1 },
    }),
    event("step.completed", {
      turnId: "t1",
      stepIndex: 1,
      usage: { costUsd: 0.2, inputTokens: 20, outputTokens: 2 },
    }),
  ]);

  assert.equal(trace.callTurns[0]?.calls[0]?.modelId, "model-a");
  assert.equal(trace.callTurns[0]?.calls[1]?.modelId, "model-b");
  assert.deepEqual(
    trace.byModel.map((entry) => entry.label),
    ["model-b", "model-a"],
  );
});

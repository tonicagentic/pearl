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
  assert.equal(trace.tools.count, 0);
  assert.equal(trace.grandCostUsd, null);
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

test("threadTraceFromEvents reads usage.recorded + model.started (current eve)", () => {
  const trace = threadTraceFromEvents([
    {
      type: "delivery.consumed",
      data: {
        turnId: "t1",
        parts: [{ kind: "text", text: "draw a house" }],
      },
      meta: { at: "2026-11-17T12:00:00.000Z" },
    },
    {
      type: "model.requested",
      scope: { turnId: "t1", runId: "r1" },
      data: { runId: "r1", owner: { turnId: "t1" } },
      meta: { at: "2026-11-17T12:00:01.000Z" },
    },
    {
      type: "model.started",
      scope: { turnId: "t1", runId: "r1" },
      data: { runId: "r1", modelId: "spacexai/grok-imagine-image-2.0", attempt: 0 },
      meta: { at: "2026-11-17T12:00:02.000Z" },
    },
    {
      type: "usage.recorded",
      scope: { turnId: "t1", runId: "r1" },
      data: {
        kind: "model",
        owner: { runId: "r1" },
        usage: {
          costUsd: 0.04,
          inputTokens: 80,
          outputTokens: 0,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
        },
      },
      meta: { at: "2026-11-17T12:00:03.000Z" },
    },
  ]);

  assert.equal(trace.totals.modelCalls, 1);
  assert.ok(Math.abs((trace.totals.costUsd ?? 0) - 0.04) < 1e-9);
  assert.equal(trace.totals.inputTokens, 80);
  assert.equal(trace.callTurns[0]?.label, "draw a house");
  assert.equal(
    trace.callTurns[0]?.calls[0]?.modelId,
    "spacexai/grok-imagine-image-2.0",
  );
  assert.equal(trace.byModel[0]?.label, "spacexai/grok-imagine-image-2.0");
});

test("threadTraceFromEvents skips delegated-late usage rollups", () => {
  const trace = threadTraceFromEvents([
    {
      type: "usage.recorded",
      data: {
        kind: "delegated-late",
        usage: { costUsd: 1, inputTokens: 10, outputTokens: 1 },
      },
      meta: { at: "2026-11-17T12:00:00.000Z" },
    },
  ]);
  assert.equal(trace.totals.modelCalls, 0);
});

test("threadTraceFromEvents prices web_search / generate_image / exa_agent_run", () => {
  const trace = threadTraceFromEvents([
    event("message.received", { turnId: "t1", message: "research then draw" }),
    event("step.started", {
      turnId: "t1",
      stepIndex: 0,
      modelId: "zai/glm-5.3-flash",
    }),
    event("step.completed", {
      turnId: "t1",
      stepIndex: 0,
      usage: { costUsd: 0.01, inputTokens: 100, outputTokens: 20 },
    }),
    event(
      "call.requested",
      {
        turnId: "t1",
        callId: "c-search",
        capability: { name: "web_search" },
        input: { type: "auto" },
        owner: { turnId: "t1" },
      },
      "2026-09-17T12:00:01.000Z",
    ),
    event(
      "call.settled",
      {
        turnId: "t1",
        callId: "c-search",
        outcome: "completed",
        output: { type: "auto", results: [{ url: "https://example.com" }] },
      },
      "2026-09-17T12:00:02.000Z",
    ),
    event(
      "call.requested",
      {
        turnId: "t1",
        callId: "c-image",
        capability: { name: "generate_image" },
        owner: { turnId: "t1" },
      },
      "2026-09-17T12:00:03.000Z",
    ),
    event(
      "call.settled",
      {
        turnId: "t1",
        callId: "c-image",
        outcome: "completed",
        output: {
          success: true,
          model: "spacexai/grok-imagine-image-2.0",
        },
      },
      "2026-09-17T12:00:04.000Z",
    ),
    event(
      "call.requested",
      {
        turnId: "t1",
        callId: "c-exa",
        capability: { name: "exa_agent_run" },
        input: { effort: "low" },
        owner: { turnId: "t1" },
      },
      "2026-09-17T12:00:05.000Z",
    ),
    event(
      "call.settled",
      {
        turnId: "t1",
        callId: "c-exa",
        outcome: "completed",
        output: {
          status: "completed",
          effort: "low",
          costDollars: { total: 0.042 },
        },
      },
      "2026-09-17T12:00:06.000Z",
    ),
  ]);

  assert.equal(trace.totals.modelCalls, 1);
  assert.ok(Math.abs((trace.totals.costUsd ?? 0) - 0.01) < 1e-9);
  assert.equal(trace.tools.count, 3);
  assert.ok(Math.abs(trace.tools.costUsd - (0.007 + 0.06 + 0.042)) < 1e-9);
  assert.ok(
    Math.abs((trace.grandCostUsd ?? 0) - (0.01 + 0.007 + 0.06 + 0.042)) < 1e-9,
  );

  assert.deepEqual(
    trace.tools.bySource.map((row) => row.source),
    ["image", "exa_agent", "web_search"],
  );
  assert.equal(trace.callTurns.length, 1);
  assert.equal(trace.callTurns[0]?.calls.length, 1);
  assert.equal(trace.callTurns[0]?.tools.length, 3);
  assert.equal(trace.callTurns[0]?.tools[0]?.source, "web_search");
  assert.equal(trace.callTurns[0]?.tools[0]?.detail, "Exa auto");
  assert.equal(trace.callTurns[0]?.tools[1]?.source, "image");
  assert.equal(trace.callTurns[0]?.tools[2]?.source, "exa_agent");
  assert.equal(trace.callTurns[0]?.tools[2]?.detail, "Exa Agent · low");
});

test("threadTraceFromEvents skips failed tool calls and ignores unknown tools", () => {
  const trace = threadTraceFromEvents([
    event("call.requested", {
      turnId: "t1",
      callId: "c-fail",
      capability: { name: "generate_image" },
      owner: { turnId: "t1" },
    }),
    event("call.settled", {
      turnId: "t1",
      callId: "c-fail",
      outcome: "completed",
      output: { success: false },
    }),
    event("call.requested", {
      turnId: "t1",
      callId: "c-other",
      capability: { name: "read_file" },
      owner: { turnId: "t1" },
    }),
    event("call.settled", {
      turnId: "t1",
      callId: "c-other",
      outcome: "completed",
      output: { ok: true },
    }),
    event("call.requested", {
      turnId: "t1",
      callId: "c-error",
      capability: { name: "web_search" },
      owner: { turnId: "t1" },
    }),
    event("call.settled", {
      turnId: "t1",
      callId: "c-error",
      outcome: "failed",
      output: { type: "auto" },
    }),
  ]);

  assert.equal(trace.tools.count, 0);
  assert.equal(trace.grandCostUsd, null);
});

test("threadTraceFromEvents attaches tool-only turns without model calls", () => {
  const trace = threadTraceFromEvents([
    event("message.received", { turnId: "t1", message: "search only" }),
    event("call.requested", {
      turnId: "t1",
      callId: "c1",
      capability: { name: "web_search" },
      input: { type: "instant" },
      owner: { turnId: "t1" },
    }),
    event("call.settled", {
      turnId: "t1",
      callId: "c1",
      outcome: "completed",
      output: { type: "instant", numResults: 5 },
    }),
  ]);

  assert.equal(trace.totals.modelCalls, 0);
  assert.equal(trace.tools.count, 1);
  assert.ok(Math.abs(trace.tools.costUsd - 0.004) < 1e-9);
  assert.equal(trace.grandCostUsd, 0.004);
  assert.equal(trace.turns, 1);
  assert.equal(trace.callTurns[0]?.label, "search only");
  assert.equal(trace.callTurns[0]?.calls.length, 0);
  assert.equal(trace.callTurns[0]?.tools[0]?.detail, "Exa instant");
});

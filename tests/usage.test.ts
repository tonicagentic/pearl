import assert from "node:assert/strict";
import { test } from "node:test";

import {
  aggregateUsage,
  emptyUsageTotals,
  formatTokens,
  formatUsd,
  type UsageRow,
} from "../lib/usage/usage.ts";

// Rows mirror what getUserUsageRows extracts from `chat_event`:
// one per eve `step.completed` stream event, with the model id joined from
// the turn's `step.started`. null fields are possible (missing usage, or
// cost omitted when the gateway did not report pricing).
function row(overrides: Partial<UsageRow> & { chatId: string }): UsageRow {
  return {
    turnId: `turn-${overrides.chatId}`,
    modelId: "zai/glm-5.3-flash",
    createdAt: new Date("2026-09-17T12:00:00Z"),
    costUsd: 0.01,
    inputTokens: 100,
    outputTokens: 50,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    ...overrides,
  };
}

test("aggregateUsage sums totals across rows and reports distinct turns", () => {
  const summary = aggregateUsage(
    [
      row({ chatId: "c1", costUsd: 0.02, inputTokens: 1000, outputTokens: 100 }),
      row({ chatId: "c1", turnId: "t2", costUsd: 0.01, inputTokens: 500, outputTokens: 50 }),
      row({ chatId: "c2", costUsd: 0.005, inputTokens: 200, outputTokens: 30 }),
    ],
    { c1: "Quarterly numbers", c2: "Ops reminder" },
  );

  assert.equal(summary.totals.modelCalls, 3);
  assert.equal(summary.totals.inputTokens, 1700);
  assert.equal(summary.totals.outputTokens, 180);
  assert.ok(Math.abs((summary.totals.costUsd ?? 0) - 0.035) < 1e-9);
  // two chats, three turns (c1 has two distinct turns)
  assert.equal(summary.turns, 3);
});

test("aggregateUsage keeps cost null only when every row lacks cost", () => {
  const allNull = aggregateUsage(
    [row({ chatId: "c1", costUsd: null }), row({ chatId: "c1", costUsd: null })],
    {},
  );
  assert.equal(allNull.totals.costUsd, null);

  const partial = aggregateUsage(
    [row({ chatId: "c1", costUsd: null }), row({ chatId: "c1", costUsd: 0.25 })],
    {},
  );
  assert.equal(partial.totals.costUsd, 0.25);
});

test("aggregateUsage groups by day, chat, and model; sorts chats by cost", () => {
  const summary = aggregateUsage(
    [
      row({
        chatId: "c1",
        createdAt: new Date("2026-09-16T23:00:00Z"),
        costUsd: 0.01,
      }),
      row({
        chatId: "c2",
        createdAt: new Date("2026-09-17T01:00:00Z"),
        modelId: "zai/glm-5.3-fast",
        costUsd: 0.2,
      }),
      row({
        chatId: "c2",
        createdAt: new Date("2026-09-17T02:00:00Z"),
        modelId: "zai/glm-5.3-fast",
        costUsd: 0.1,
      }),
    ],
    { c1: "Chat one", c2: "Chat two" },
  );

  assert.deepEqual(
    summary.byDay.map((entry) => entry.day),
    ["2026-09-16", "2026-09-17"],
  );
  // per-chat labels use titles; c2 (0.30) sorts before c1 (0.01)
  assert.deepEqual(
    summary.byChat.map((entry) => entry.label),
    ["Chat two", "Chat one"],
  );
  assert.ok(Math.abs((summary.byChat[0]?.costUsd ?? 0) - 0.3) < 1e-9);
  // per-model: two distinct models, -fast (0.30) sorts before flash (0.01)
  assert.deepEqual(
    summary.byModel.map((entry) => entry.label),
    ["zai/glm-5.3-fast", "zai/glm-5.3-flash"],
  );
});

test("aggregateUsage falls back to unknown model and raw chat id without titles", () => {
  const summary = aggregateUsage(
    [row({ chatId: "c9", modelId: null, costUsd: null })],
    {},
  );

  assert.deepEqual(
    summary.byModel.map((entry) => entry.label),
    ["unknown"],
  );
  assert.equal(summary.byChat[0]?.label, "c9");
});

test("aggregateUsage ignores negative and non-finite numbers", () => {
  const summary = aggregateUsage(
    [row({ chatId: "c1", costUsd: -1, inputTokens: Number.NaN })],
    {},
  );

  assert.equal(summary.totals.costUsd, 0);
  assert.equal(summary.totals.inputTokens, 0);
});

test("emptyUsageTotals is the neutral element", () => {
  const summary = aggregateUsage([], {});
  assert.deepEqual(summary.totals, emptyUsageTotals());
  assert.equal(summary.turns, 0);
});

test("formatTokens compacts and formatUsd keeps small costs readable", () => {
  assert.equal(formatTokens(0), "0");
  assert.equal(formatTokens(999), "999");
  assert.equal(formatTokens(1500), "1.5k");
  assert.equal(formatTokens(1_000_000), "1M");
  assert.equal(formatTokens(2_500_000), "2.5M");

  assert.equal(formatUsd(null), "—");
  assert.equal(formatUsd(0), "$0.0000");
  assert.equal(formatUsd(0.0018137), "$0.0018");
  assert.equal(formatUsd(0.5), "$0.500");
  assert.equal(formatUsd(12.5), "$12.50");
});

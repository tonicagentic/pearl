import assert from "node:assert/strict";
import { test } from "node:test";

import {
  costMeterProps,
  quotaBannerProps,
} from "../lib/usage/cost-drawer-props.ts";
import type { ThreadTrace } from "../lib/usage/thread-trace.ts";
import { emptyUsageTotals } from "../lib/usage/usage.ts";

function baseTrace(overrides: Partial<ThreadTrace> = {}): ThreadTrace {
  return {
    byModel: [],
    callTurns: [],
    grandCostUsd: null,
    lastTurnCostUsd: null,
    spans: [],
    tools: {
      bySource: [],
      charges: [],
      costUsd: 0,
      count: 0,
    },
    totals: emptyUsageTotals(),
    totalMs: 0,
    turns: 0,
    ...overrides,
  };
}

test("costMeterProps computes model share from dollar totals", () => {
  const props = costMeterProps(
    baseTrace({
      byModel: [
        {
          ...emptyUsageTotals(),
          cacheReadTokens: 0,
          costUsd: 0.03,
          inputTokens: 100,
          label: "model-a",
          modelCalls: 1,
          outputTokens: 10,
        },
        {
          ...emptyUsageTotals(),
          cacheReadTokens: 5,
          costUsd: 0.01,
          inputTokens: 50,
          label: "model-b",
          modelCalls: 1,
          outputTokens: 5,
        },
      ],
      grandCostUsd: 0.04,
      lastTurnCostUsd: 0.01,
    }),
  );

  assert.equal(props.lines.length, 2);
  assert.ok(Math.abs(props.lines[0]!.share - 0.75) < 1e-9);
  assert.ok(Math.abs(props.lines[1]!.share - 0.25) < 1e-9);
  assert.equal(props.lines[0]!.model, "model-a");
  assert.match(props.runCost, /\$/);
  assert.match(props.sessionCost, /\$/);
});

test("quotaBannerProps returns null when billing is off, exempt, or uncapped", () => {
  assert.equal(quotaBannerProps(null), null);
  assert.equal(quotaBannerProps({ enabled: false, usageCapCents: 1000 }), null);
  assert.equal(
    quotaBannerProps({ enabled: true, exempt: true, usageCapCents: 1000 }),
    null,
  );
  assert.equal(
    quotaBannerProps({ enabled: true, usageCapCents: null, spentCents: 100 }),
    null,
  );
  assert.equal(
    quotaBannerProps({ enabled: true, usageCapCents: 0, spentCents: 0 }),
    null,
  );
});

test("quotaBannerProps maps cents to dollars and formats resetsIn", () => {
  const nowMs = Date.parse("2026-11-17T12:00:00.000Z");
  const props = quotaBannerProps(
    {
      enabled: true,
      periodEnd: "2026-11-18T12:00:00.000Z",
      spentCents: 724,
      usageCapCents: 1000,
    },
    { nowMs },
  );

  assert.ok(props);
  assert.equal(props!.unit, "dollars");
  assert.equal(props!.used, 7.24);
  assert.equal(props!.limit, 10);
  assert.equal(props!.resetsIn, "24h");
});

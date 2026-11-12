import assert from "node:assert/strict";
import { test } from "node:test";

import {
  sandboxCostCents,
  usdToCents,
} from "../lib/billing/ledger.ts";
import {
  DEFAULT_USAGE_CAP_CENTS,
  WEB_SEARCH_FALLBACK_CENTS,
} from "../lib/billing/config.ts";

test("usdToCents rounds to nearest cent and rejects negatives", () => {
  assert.equal(usdToCents(0.019), 2);
  assert.equal(usdToCents(1.5), 150);
  assert.equal(usdToCents(-1), 0);
  assert.equal(usdToCents(null), 0);
  assert.equal(usdToCents(Number.NaN), 0);
});

test("sandboxCostCents scales with vCPU and duration", () => {
  const oneMinuteTwoCpu = sandboxCostCents({
    vcpus: 2,
    durationMs: 60_000,
  });
  assert.ok(oneMinuteTwoCpu > 0);
  const twoMinutes = sandboxCostCents({
    vcpus: 2,
    durationMs: 120_000,
  });
  assert.ok(twoMinutes >= oneMinuteTwoCpu * 2 - 1);
});

test("default usage cap is $50", () => {
  assert.equal(DEFAULT_USAGE_CAP_CENTS, 5000);
  assert.equal(WEB_SEARCH_FALLBACK_CENTS, 1);
});

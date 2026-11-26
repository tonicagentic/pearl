import assert from "node:assert/strict";
import { test } from "node:test";

import {
  sandboxCostCents,
  usdToCents,
} from "../lib/billing/ledger.ts";
import {
  DEFAULT_TRIAL_CAP_CENTS,
  DEFAULT_USAGE_CAP_CENTS,
  INCLUDED_USAGE_CENTS,
  SUBSCRIPTION_PRICE_CENTS,
  blockMessage,
  getTrialCapCents,
  isEmailOnTrialAllowlist,
  WEB_SEARCH_FALLBACK_CENTS,
} from "../lib/billing/config.ts";

/** Mirrors `effectiveUsageCapCents` in lib/billing/accounts.ts (no DB import). */
function effectiveUsageCapCents(account: {
  readonly usageCapCents: number;
  readonly prepaidCreditCents: number | null | undefined;
}): number {
  return account.usageCapCents + Math.max(0, account.prepaidCreditCents ?? 0);
}

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

test("pricing defaults: $29.99 sub, $10 included, $100 spend cap, $20 trial", () => {
  assert.equal(SUBSCRIPTION_PRICE_CENTS, 2999);
  assert.equal(INCLUDED_USAGE_CENTS, 1000);
  assert.equal(DEFAULT_USAGE_CAP_CENTS, 10_000);
  assert.equal(DEFAULT_TRIAL_CAP_CENTS, 2000);
  assert.equal(getTrialCapCents(), 2000);
  assert.equal(WEB_SEARCH_FALLBACK_CENTS, 1);
});

test("effectiveUsageCapCents adds prepaid credits to the base cap", () => {
  assert.equal(
    effectiveUsageCapCents({ usageCapCents: INCLUDED_USAGE_CENTS, prepaidCreditCents: 0 }),
    1000,
  );
  assert.equal(
    effectiveUsageCapCents({
      usageCapCents: INCLUDED_USAGE_CENTS,
      prepaidCreditCents: 2500,
    }),
    3500,
  );
  assert.equal(
    effectiveUsageCapCents({
      usageCapCents: DEFAULT_USAGE_CAP_CENTS,
      prepaidCreditCents: null,
    }),
    10_000,
  );
});

test("block messages mention current pricing", () => {
  assert.match(blockMessage("unpaid"), /\$29\.99/);
  assert.match(blockMessage("trial_cap_reached"), /\$20/);
  assert.match(blockMessage("trial_cap_reached"), /\$29\.99/);
  assert.match(blockMessage("cap_reached"), /credit pack|cap|billing/i);
});

test("trial allowlist matches emails case-insensitively", () => {
  const previous = process.env.PEARL_TRIAL_ALLOWLIST;
  process.env.PEARL_TRIAL_ALLOWLIST = "Brennanwsmart@gmail.com, other@example.com";
  try {
    assert.equal(isEmailOnTrialAllowlist("brennanwsmart@gmail.com"), true);
    assert.equal(isEmailOnTrialAllowlist("Brennanwsmart@gmail.com"), true);
    assert.equal(isEmailOnTrialAllowlist("stranger@example.com"), false);
  } finally {
    if (previous === undefined) {
      delete process.env.PEARL_TRIAL_ALLOWLIST;
    } else {
      process.env.PEARL_TRIAL_ALLOWLIST = previous;
    }
  }
});

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  DEFAULT_IMAGE_MICROS,
  DEFAULT_IMAGE_USD,
  EXA_SEARCH_AUTO_MICROS,
  EXA_SEARCH_AUTO_USD,
  exaAgentEffortUsd,
  exaSearchMicros,
  exaSearchUsd,
  formatSpendUsd,
  imageMicros,
  imageUsd,
  microsToUsd,
  parseExaCostDollars,
  usdToMicros,
} from "../lib/billing/provider-pricing.ts";

test("parseExaCostDollars reads object.total (Exa Agent wire shape)", () => {
  const parsed = parseExaCostDollars({
    total: 0.25,
    agentCompute: 0.1,
    search: 0.15,
    emails: 0,
    phoneNumbers: 0,
  });
  assert.equal(parsed?.total, 0.25);
  assert.equal(parsed?.agentCompute, 0.1);
  assert.equal(parsed?.search, 0.15);
});

test("parseExaCostDollars accepts a bare number", () => {
  assert.equal(parseExaCostDollars(1.5)?.total, 1.5);
  assert.equal(parseExaCostDollars(null), null);
  assert.equal(parseExaCostDollars({ total: "nope" }), null);
});

test("exaSearchMicros keeps Exa auto/instant rates exact", () => {
  assert.equal(exaSearchMicros(), EXA_SEARCH_AUTO_MICROS);
  assert.equal(exaSearchUsd(), EXA_SEARCH_AUTO_USD);
  assert.equal(exaSearchMicros({ type: "instant" }), 4_000);
  assert.equal(exaSearchMicros({ type: "auto", numResults: 20 }), 7_000 + 10_000);
});

test("exaAgentEffortUsd maps fixed efforts", () => {
  assert.equal(exaAgentEffortUsd("low"), 0.025);
  assert.equal(exaAgentEffortUsd("auto"), null);
});

test("imageMicros prefers reported cost then catalog list price", () => {
  assert.deepEqual(
    imageMicros({ modelId: "spacexai/grok-imagine-image-2.0" }),
    { micros: 60_000, pricing: "catalog" },
  );
  assert.deepEqual(
    imageUsd({ modelId: "meta/muse-image-1.0", imageCount: 2 }),
    { usd: 0.02, pricing: "catalog" },
  );
  assert.deepEqual(
    imageMicros({ modelId: "unknown/model", reportedUsd: 0.12 }),
    { micros: usdToMicros(0.12), pricing: "provider" },
  );
  assert.deepEqual(imageMicros({ modelId: "unknown/model" }), {
    micros: DEFAULT_IMAGE_MICROS,
    pricing: "default",
  });
  assert.equal(DEFAULT_IMAGE_USD, 0.06);
});

test("micros round-trip preserves Exa search exactness", () => {
  assert.equal(microsToUsd(EXA_SEARCH_AUTO_MICROS), 0.007);
  assert.equal(usdToMicros(0.007), 7_000);
  assert.equal(formatSpendUsd(0.007), "$0.007");
  assert.equal(formatSpendUsd(0.06), "$0.06");
  assert.equal(formatSpendUsd(1.5), "$1.50");
});

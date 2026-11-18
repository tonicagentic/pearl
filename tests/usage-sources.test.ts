import assert from "node:assert/strict";
import { test } from "node:test";

import {
  DEFAULT_IMAGE_USD,
  EXA_SEARCH_AUTO_USD,
} from "../lib/billing/provider-pricing.ts";
import {
  formatEventRate,
  usageSourceMeta,
} from "../lib/usage/sources.ts";

test("web search and image sources expose Exa / Gateway list rates", () => {
  assert.equal(usageSourceMeta("web_search").unitUsd, EXA_SEARCH_AUTO_USD);
  assert.equal(usageSourceMeta("web_search").provider, "Exa Search (AI Gateway)");
  assert.equal(usageSourceMeta("exa_agent").provider, "Exa Agent API");
  assert.equal(usageSourceMeta("exa_agent").unitUsd, null);
  assert.equal(usageSourceMeta("image").unitUsd, DEFAULT_IMAGE_USD);
});

test("formatEventRate prefers fixed unit when every event matches", () => {
  assert.equal(
    formatEventRate({
      eventCount: 12,
      costUsd: 12 * 0.007,
      unitUsd: 0.007,
      unitNoun: "searches",
    }),
    "12 × $0.007",
  );
  assert.equal(
    formatEventRate({
      eventCount: 3,
      costUsd: 1.5,
      unitUsd: null,
      unitNoun: "runs",
    }),
    "3 runs · avg $0.5",
  );
});

import assert from "node:assert/strict";
import test from "node:test";

import {
  PLAYWRIGHT_CAPTURE_NETWORK_ALLOW,
  playwrightCaptureNetworkPolicy,
} from "../lib/sandbox/playwright-network.ts";

test("playwright capture policy is never allow-all", () => {
  const policy = playwrightCaptureNetworkPolicy(
    "https://widgets-abc.vercel.app/login",
  );
  assert.notEqual(policy, "allow-all");
  assert.ok(Array.isArray(policy.allow));
  assert.ok(policy.allow.includes("registry.npmjs.org"));
  assert.ok(
    PLAYWRIGHT_CAPTURE_NETWORK_ALLOW.every((host) =>
      policy.allow.includes(host),
    ),
  );
  assert.ok(policy.allow.includes("widgets-abc.vercel.app"));
});

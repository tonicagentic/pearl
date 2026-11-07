import assert from "node:assert/strict";
import { test } from "node:test";

import { BROWSER_SUBNET_DENY } from "../lib/browser/session.ts";

test("browser subnet deny list is IPv4-only (Vercel Sandbox rejects IPv6 CIDRs)", () => {
  assert.ok(BROWSER_SUBNET_DENY.length > 0);
  for (const cidr of BROWSER_SUBNET_DENY) {
    assert.match(cidr, /^\d+\.\d+\.\d+\.\d+\/\d+$/, `unexpected CIDR: ${cidr}`);
    assert.doesNotMatch(cidr, /:/, `IPv6 CIDR not allowed: ${cidr}`);
  }
  assert.ok(BROWSER_SUBNET_DENY.includes("169.254.0.0/16"));
  assert.ok(BROWSER_SUBNET_DENY.includes("127.0.0.0/8"));
});

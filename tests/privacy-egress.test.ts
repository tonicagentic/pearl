import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CLASS_LABELS,
  checkEgress,
  detectPrivateClasses,
} from "../lib/privacy/redact.ts";

// Part 6 (privacy): private context must not reach external calls unless the
// tool is allowlisted for that data class. The gate fails closed.

test("detects health information", () => {
  assert.deepEqual(detectPrivateClasses("I'm HIV+ and starting chemotherapy"), ["health"]);
});

test("detects financial data", () => {
  assert.deepEqual(detectPrivateClasses("my salary is 240k and my account number is 12345678"), ["financial"]);
  assert.ok(detectPrivateClasses("card 4111 1111 1111 1111 expiring soon").includes("financial"));
});

test("detects credentials", () => {
  assert.ok(detectPrivateClasses("use this api key sk-live-abc123def456ghi789jkl012mno345").includes("credential"));
  assert.ok(detectPrivateClasses("the password is hunter2").includes("credential"));
});

test("detects identifiers", () => {
  assert.ok(detectPrivateClasses("my SSN is 123-45-6789").includes("identifier"));
  assert.ok(detectPrivateClasses("date of birth: 1990-04-01").includes("identifier"));
});

test("clean operational text passes", () => {
  assert.deepEqual(detectPrivateClasses("Team standup moved to 10am, deploy is green"), []);
});

test("checkEgress: default deny fails closed with an actionable reason", () => {
  const result = checkEgress("book my flight — I'm HIV+ and need special assistance");
  assert.equal(result.ok, false);
  assert.ok(!result.ok);
  assert.deepEqual(result.classes, ["health"]);
  assert.match(result.reason, new RegExp(CLASS_LABELS.health, "i"));
  assert.match(result.reason, /refused|ask the user/i);
});

test("checkEgress: allowlisted data class passes for that tool only", () => {
  const result = checkEgress("blood work results attached", { allowed: ["health"] });
  assert.equal(result.ok, true);
});

test("checkEgress: allowlisting one class still blocks the others", () => {
  const result = checkEgress("HIV+ and card 4111 1111 1111 1111", { allowed: ["health"] });
  assert.equal(result.ok, false);
  assert.ok(!result.ok);
  assert.deepEqual(result.classes, ["financial"]);
});

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  classifyCoderHeuristic,
  shouldEscalateFromHistory,
} from "../agent/subagents/coder/model-router.ts";

test("classifyCoderHeuristic routes trivial docs work to fast", () => {
  assert.equal(
    classifyCoderHeuristic("Fix a typo in the README spelling"),
    "fast",
  );
});

test("classifyCoderHeuristic routes hard auth races to frontier", () => {
  assert.equal(
    classifyCoderHeuristic(
      "Investigate a flaky auth race in the OAuth callback",
    ),
    "frontier",
  );
});

test("classifyCoderHeuristic leaves ambiguous work undecided", () => {
  assert.equal(
    classifyCoderHeuristic("Add a settings page for notification prefs"),
    null,
  );
});

test("shouldEscalateFromHistory trips after repeated failure markers", () => {
  const messages = [
    {
      role: "tool",
      content: [{ type: "tool-result", output: { type: "text", value: "exitCode: 1 typecheck failed" } }],
    },
    {
      role: "tool",
      content: [{ type: "tool-result", output: { type: "text", value: "Error: tests failed" } }],
    },
  ];
  assert.equal(shouldEscalateFromHistory(messages), true);
});

test("shouldEscalateFromHistory stays quiet on a clean transcript", () => {
  const messages = [
    {
      role: "tool",
      content: [{ type: "tool-result", output: { type: "text", value: "All checks passed" } }],
    },
  ];
  assert.equal(shouldEscalateFromHistory(messages), false);
});

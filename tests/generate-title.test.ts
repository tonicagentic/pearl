import assert from "node:assert/strict";
import { test } from "node:test";

import {
  firstUserTextFromEvents,
  isAutoTitle,
  sanitizeGeneratedTitle,
} from "../lib/chat/generate-title.ts";
import {
  createFallbackTitle,
  DEFAULT_CHAT_TITLE,
} from "../lib/chat/title.ts";

test("isAutoTitle treats default and first-message fallback as auto", () => {
  const seed = "Can you write up a plan for the launch?";
  assert.equal(isAutoTitle(DEFAULT_CHAT_TITLE, seed), true);
  assert.equal(isAutoTitle(createFallbackTitle(seed), seed), true);
});

test("isAutoTitle skips user renames and prior LLM titles", () => {
  const seed = "Can you write up a plan for the launch?";
  assert.equal(isAutoTitle("Launch Plan Draft", seed), false);
  assert.equal(isAutoTitle("Something else", seed), false);
});

test("isAutoTitle is false for empty seed unless title is default", () => {
  assert.equal(isAutoTitle(DEFAULT_CHAT_TITLE, ""), true);
  assert.equal(isAutoTitle("Launch Plan", ""), false);
  assert.equal(isAutoTitle("Launch Plan", "   "), false);
});

test("sanitizeGeneratedTitle strips quotes, fluff, and caps length", () => {
  assert.equal(sanitizeGeneratedTitle('"Launch Plan Draft"'), "Launch Plan Draft");
  assert.equal(sanitizeGeneratedTitle("  Launch Plan.  "), "Launch Plan");
  assert.equal(sanitizeGeneratedTitle("`Weekly Review`"), "Weekly Review");
  const long = "A".repeat(100);
  const capped = sanitizeGeneratedTitle(long);
  assert.ok(capped.length <= 72);
  assert.ok(capped.endsWith("..."));
});

test("sanitizeGeneratedTitle falls back to default on empty fluff", () => {
  assert.equal(sanitizeGeneratedTitle('""'), DEFAULT_CHAT_TITLE);
  assert.equal(sanitizeGeneratedTitle("..."), DEFAULT_CHAT_TITLE);
  assert.equal(sanitizeGeneratedTitle("   "), DEFAULT_CHAT_TITLE);
});

test("firstUserTextFromEvents reads delivery.consumed parts", () => {
  const events = [
    {
      type: "session.started",
      data: {},
      meta: { at: "2026-01-01T00:00:00.000Z", position: { line: 0, index: 0 } },
    },
    {
      type: "delivery.consumed",
      data: {
        deliveryId: "d1",
        turnId: "t1",
        parts: [{ kind: "text", text: "Plan the launch week" }],
      },
      meta: { at: "2026-01-01T00:00:01.000Z", position: { line: 1, index: 0 } },
    },
  ] as const;

  assert.equal(
    firstUserTextFromEvents(events as never),
    "Plan the launch week",
  );
});

test("firstUserTextFromEvents returns null when no user text", () => {
  assert.equal(firstUserTextFromEvents([]), null);
  assert.equal(
    firstUserTextFromEvents([
      {
        type: "delivery.consumed",
        data: { deliveryId: "d1", turnId: "t1", parts: [] },
        meta: { position: { line: 0, index: 0 } },
      },
    ] as never),
    null,
  );
});

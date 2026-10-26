import assert from "node:assert/strict";
import { test } from "node:test";

import {
  CATCH_UP_WINDOW_MS,
  LIVE_MAX_PER_FRAME,
  nextRevealLength,
  shouldShowThinking,
  withPendingAssistant,
} from "../mobile/src/stream-presentation.ts";

test("the pre-content state hands off once reasoning, tools, or text are visible", () => {
  assert.equal(shouldShowThinking(true, []), true);
  assert.equal(shouldShowThinking(true, [{ type: "indicator" }]), true);
  assert.equal(shouldShowThinking(true, [{ type: "reasoning", text: "Checking" }]), false);
  assert.equal(shouldShowThinking(true, [{ type: "tool-call" }]), false);
  assert.equal(shouldShowThinking(true, [{ type: "text", text: "Hello" }]), false);
  assert.equal(shouldShowThinking(false, []), false);
});

test("a continuous live stream advances on frames instead of waiting for silence", () => {
  let shown = 0;
  let carry = 0;
  for (const text of ["a", "ab", "abc", "abcd", "abcde", "abcdef"]) {
    const step = nextRevealLength(text, shown, 16, { mode: "live", carry });
    shown = step.end;
    carry = step.carry;
    assert.ok(shown > 0 && shown <= text.length);
  }
  // Fractional carry may trail one glyph; a couple more frames close the gap.
  const final = "abcdef";
  for (let i = 0; i < 4 && shown < final.length; i++) {
    const step = nextRevealLength(final, shown, 16, { mode: "live", carry });
    shown = step.end;
    carry = step.carry;
  }
  assert.equal(shown, 6);
});

test("live bursts stay paced over multiple frames without splitting surrogate pairs", () => {
  const text = "🙂" + "x".repeat(500);
  let step = nextRevealLength(text, 0, 16, { mode: "live" });
  let shown = step.end;
  // First frame always opens with a glyph; emoji is one code point (2 UTF-16).
  assert.ok(shown >= 2 && shown <= LIVE_MAX_PER_FRAME * 2);
  assert.ok(shown < text.length);
  const before = shown;
  let carry = step.carry;
  for (let i = 0; i < 8; i++) {
    step = nextRevealLength(text, shown, 16, { mode: "live", carry });
    shown = step.end;
    carry = step.carry;
  }
  assert.ok(shown > before && shown < text.length);
  for (let i = 0; i < 500 && shown < text.length; i++) {
    step = nextRevealLength(text, shown, 16, { mode: "live", carry });
    assert.ok(step.end > shown && step.end <= text.length);
    shown = step.end;
    carry = step.carry;
  }
  assert.equal(shown, text.length);
});

test("catch-up eases a finished burst closed by its deadline", () => {
  const text = "x".repeat(4096);
  let step = nextRevealLength(text, 0, 16, {
    mode: "catchUp",
    remainingMs: CATCH_UP_WINDOW_MS,
    windowMs: CATCH_UP_WINDOW_MS,
  });
  let shown = step.end;
  let carry = step.carry;
  assert.ok(shown > 0 && shown < text.length);
  for (
    let elapsed = 32;
    elapsed <= CATCH_UP_WINDOW_MS + 16 && shown < text.length;
    elapsed += 16
  ) {
    step = nextRevealLength(text, shown, 16, {
      mode: "catchUp",
      remainingMs: Math.max(0, CATCH_UP_WINDOW_MS - elapsed),
      windowMs: CATCH_UP_WINDOW_MS,
      carry,
    });
    shown = step.end;
    carry = step.carry;
  }
  assert.equal(shown, text.length);
});

test("history and cancelled turns can show their authoritative text at once", () => {
  const text = "x".repeat(100);
  assert.equal(
    nextRevealLength(text, 0, 16, { mode: "catchUp", remainingMs: 0 }).end,
    text.length,
  );
});

test("the accepted user turn gets one replaceable working assistant row", () => {
  const user = { role: "user", content: [{ type: "text", text: "Hello" }] };
  const accepted = [{ role: "user", metadata: { status: "complete" } }];
  const projected = withPendingAssistant([user], accepted, true);
  assert.equal(projected.length, 2);
  assert.deepEqual(projected[1], { role: "assistant", content: [], status: { type: "running" } });
  assert.equal(withPendingAssistant(projected, accepted, true).length, 2);
  const response = { role: "assistant", content: [{ type: "text", text: "Hi" }] };
  assert.deepEqual(withPendingAssistant([user, response], [...accepted, { role: "assistant" }], true), [user, response]);
});

test("no assistant placeholder before acceptance or after a stopped turn", () => {
  const user = { role: "user", content: [] };
  assert.deepEqual(withPendingAssistant([user], [{ role: "user", metadata: { status: "submitted" } }], true), [user]);
  assert.deepEqual(withPendingAssistant([user], [{ role: "user", metadata: { status: "complete" } }], false), [user]);
});

test("an optimistic preparing turn gets a Thinking placeholder before streaming", () => {
  const user = { role: "user", content: [{ type: "text", text: "Hello" }] };
  const projected = withPendingAssistant([user], [{ role: "user", metadata: { status: "submitted" } }], false, true);
  assert.equal(projected.length, 2);
  assert.deepEqual(projected[1], { role: "assistant", content: [], status: { type: "running" } });
  assert.deepEqual(withPendingAssistant([user], [{ role: "user", metadata: { status: "submitted" } }], false, false), [user]);
});

import assert from "node:assert/strict";
import { test } from "node:test";

import { nextRevealLength, withPendingAssistant } from "../mobile/src/stream-presentation.ts";

test("a continuous stream advances on frames instead of waiting for silence", () => {
  let shown = 0;
  for (const text of ["a", "ab", "abc", "abcd", "abcde", "abcdef"]) {
    shown = nextRevealLength(text, shown, 16);
    assert.ok(shown > 0 && shown <= text.length);
  }
  assert.equal(shown, 6);
});

test("bursts drain in bounded steps without splitting surrogate pairs", () => {
  const text = "🙂" + "x".repeat(500);
  let shown = nextRevealLength(text, 0, 16);
  assert.equal(shown, 32); // 31 code points, emoji occupies two UTF-16 units.
  for (let i = 0; i < 100 && shown < text.length; i++) {
    const next = nextRevealLength(text, shown, 16);
    assert.ok(next > shown && next <= text.length);
    shown = next;
  }
  assert.equal(shown, text.length);
});

test("a multi-kilobyte live burst is revealed, then caught up by its deadline", () => {
  const text = "x".repeat(4096);
  let shown = nextRevealLength(text, 0, 16, 260);
  assert.ok(shown > 0 && shown < text.length);
  for (let elapsed = 32; elapsed <= 272 && shown < text.length; elapsed += 16) {
    shown = nextRevealLength(text, shown, 16, Math.max(0, 260 - elapsed));
  }
  assert.equal(shown, text.length);
});

test("history and cancelled turns can show their authoritative text at once", () => {
  const text = "x".repeat(100);
  assert.equal(nextRevealLength(text, 0, 16, 0), text.length);
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

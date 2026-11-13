import assert from "node:assert/strict";
import { test } from "node:test";

import {
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

test("a live stream reveals every character already received", () => {
  let shown = 0;
  for (const text of ["a", "ab", "abc", "abcd", "abcde", "abcdef"]) {
    const step = nextRevealLength(text, shown, 16, { mode: "live" });
    shown = step.end;
    assert.equal(shown, text.length);
  }
  assert.equal(shown, 6);
});

test("live bursts open to the full buffer with no per-frame cap", () => {
  const text = "🙂" + "x".repeat(500);
  const step = nextRevealLength(text, 0, 16, { mode: "live" });
  assert.equal(step.end, text.length);
  assert.equal(step.carry, 0);
});

test("finished buffers show their authoritative text at once", () => {
  const text = "x".repeat(4096);
  assert.equal(nextRevealLength(text, 0, 16).end, text.length);
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

test("sticky awaitingReply keeps Thinking after localSend clears before busy", () => {
  const user = { role: "user", content: [{ type: "text", text: "Hello" }] };
  // deliveryId accepted: not streaming yet, user may still be submitted, but
  // chat-screen keeps awaitingReply until an assistant row exists.
  const projected = withPendingAssistant(
    [user],
    [{ role: "user", metadata: { status: "submitted" } }],
    false,
    true,
  );
  assert.equal(projected.length, 2);
  assert.deepEqual(projected[1], { role: "assistant", content: [], status: { type: "running" } });
});

test("accepted send with sticky awaitingReply keeps Thinking while user is still submitted", () => {
  // Mirrors chat-screen after deliveryId clears localSend: no preparing phase,
  // store not busy yet, eve user row not complete — sticky flag alone must hold.
  const user = { role: "user", content: [{ type: "text", text: "Hi there Pearl" }] };
  const withoutSticky = withPendingAssistant(
    [user],
    [{ role: "user", metadata: { status: "submitted" } }],
    false,
    false,
  );
  assert.equal(withoutSticky.length, 1);
  const withSticky = withPendingAssistant(
    [user],
    [{ role: "user", metadata: { status: "submitted" } }],
    false,
    true,
  );
  assert.equal(withSticky.length, 2);
  assert.deepEqual(withSticky[1], {
    role: "assistant",
    content: [],
    status: { type: "running" },
  });
});

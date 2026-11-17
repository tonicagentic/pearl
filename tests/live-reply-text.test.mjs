import assert from "node:assert/strict";
import { test } from "node:test";

import {
  __resetLiveReplyTextForTests,
  clearLiveReplyText,
  getLiveReplyParts,
  getLiveReplyVersion,
  pushLiveReplyDelta,
  reconcileLiveReplyWithSnapshot,
} from "../mobile/src/live-reply-text.ts";
import { applyLiveReplyOverlay } from "../mobile/src/apply-live-reply.ts";

test("live reply accumulates text deltas ahead of the snapshot", () => {
  __resetLiveReplyTextForTests();
  pushLiveReplyDelta({ partId: "t1", kind: "text", delta: "Hello" });
  pushLiveReplyDelta({ partId: "t1", delta: " world" });
  assert.deepEqual(getLiveReplyParts(), [{ id: "t1", text: "Hello world" }]);
  assert.equal(getLiveReplyVersion(), 2);
});

test("live reply ignores reasoning deltas", () => {
  __resetLiveReplyTextForTests();
  pushLiveReplyDelta({ partId: "r1", kind: "reasoning", delta: "thinking" });
  assert.deepEqual(getLiveReplyParts(), []);
});

test("live reply accepts first delta when kind is omitted", () => {
  __resetLiveReplyTextForTests();
  pushLiveReplyDelta({ partId: "run_0.0", delta: "**Hi**" });
  pushLiveReplyDelta({ partId: "run_0.0", delta: " there" });
  assert.deepEqual(getLiveReplyParts(), [
    { id: "run_0.0", text: "**Hi** there" },
  ]);
});

test("overlay injects text onto the last assistant before the part exists", () => {
  __resetLiveReplyTextForTests();
  pushLiveReplyDelta({ partId: "t1", kind: "text", delta: "Hi" });
  const next = applyLiveReplyOverlay([
    { role: "user", content: [{ type: "text", text: "Hey" }] },
  ]);
  assert.equal(next.length, 2);
  assert.equal(next[1]?.role, "assistant");
  assert.deepEqual(next[1]?.content, [
    { type: "text", text: "Hi", id: "t1" },
  ]);
});

test("overlay lengthens an existing text part when live is ahead", () => {
  __resetLiveReplyTextForTests();
  pushLiveReplyDelta({ partId: "t1", kind: "text", delta: "Hello there" });
  const next = applyLiveReplyOverlay([
    {
      role: "assistant",
      status: { type: "running" },
      content: [{ type: "text", text: "Hello", id: "t1" }],
    },
  ]);
  assert.equal(next[0]?.content?.[0]?.text, "Hello there");
});

test("reconcile clears live text once the snapshot catches up", () => {
  __resetLiveReplyTextForTests();
  pushLiveReplyDelta({ partId: "t1", kind: "text", delta: "Done" });
  reconcileLiveReplyWithSnapshot([
    {
      role: "assistant",
      parts: [{ type: "text", id: "t1", text: "Done" }],
    },
  ]);
  assert.deepEqual(getLiveReplyParts(), []);
  clearLiveReplyText();
});

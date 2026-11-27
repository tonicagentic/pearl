import assert from "node:assert/strict";
import { test } from "node:test";
import {
  __resetStreamingRevealForTests,
  advanceStreamingReveal,
  snapStreamingReveal,
  tokenize,
} from "../lib/streaming-text-reveal.ts";

test("snapStreamingReveal shows the buffered catch-up text immediately with no fade", () => {
  __resetStreamingRevealForTests();
  snapStreamingReveal();
  const tokens = tokenize("one two three four five six");
  const progress = advanceStreamingReveal(tokens, 20, 1_000);
  assert.equal(progress.shown, 6);
  assert.equal(progress.fadeFromWord, 6);
});

test("snapStreamingReveal paces only growth after the snapped backlog", () => {
  __resetStreamingRevealForTests();
  snapStreamingReveal();
  const backlog = tokenize("one two three four five six");
  const first = advanceStreamingReveal(backlog, 20, 1_000);
  assert.equal(first.shown, 6);
  assert.equal(first.fadeFromWord, 6);

  const grown = tokenize("one two three four five six seven");
  const next = advanceStreamingReveal(grown, 20, 1_010);
  assert.equal(next.fadeFromWord, 6);
  assert.ok(next.shown >= 6);
  assert.ok(next.shown <= 7);
});

test("keyed reveal progress keeps concurrent parts isolated", () => {
  __resetStreamingRevealForTests();
  const tokensA = tokenize("one two three");
  const tokensB = tokenize("alpha beta gamma delta");
  snapStreamingReveal("msgA:p1");
  const a = advanceStreamingReveal(tokensA, 20, 1_000, "msgA:p1");
  assert.equal(a.shown, 3);

  snapStreamingReveal("msgB:p1");
  const b = advanceStreamingReveal(tokensB, 20, 1_000, "msgB:p1");
  assert.equal(b.shown, 4);

  // Resetting A must not wipe B's snapped progress.
  snapStreamingReveal("msgA:p1");
  const bAgain = advanceStreamingReveal(tokensB, 20, 1_050, "msgB:p1");
  assert.equal(bAgain.shown, 4);
  assert.equal(bAgain.fadeFromWord, 4);
});

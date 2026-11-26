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

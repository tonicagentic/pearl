import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createStreamTurnTrace,
  firstDeltaMs,
  firstPaintMs,
  isBurstyGaps,
  isIncrementalDeltas,
  streamTurnMetrics,
} from "../mobile/src/stream-contract.ts";

test("turn milestones record first delta, gaps, paint, and settled metrics", () => {
  const turn = createStreamTurnTrace("send-2", 0);
  turn.send(0);
  // Shape from the measured Pearl send-2: ~3.5s TTFT, ~50ms gaps, small chunks.
  turn.delta(2, 3552);
  turn.paint(2, 3581);
  turn.delta(8, 3617);
  turn.delta(3, 3667);
  turn.delta(5, 3717);
  turn.delta(5, 3767);
  turn.delta(1, 3816);
  const snapshot = turn.settled(4056);
  const metrics = streamTurnMetrics(snapshot);

  assert.equal(firstDeltaMs(snapshot), 3552);
  assert.equal(firstPaintMs(snapshot), 3581);
  assert.equal(metrics.deltas, 6);
  assert.equal(metrics.chars, 24);
  assert.equal(metrics.lastGapMs, 49);
  assert.ok(metrics.maxGapMs !== null && metrics.maxGapMs <= 65);
  assert.equal(metrics.bursty, false);
  assert.equal(metrics.incremental, true);
});

test("isIncrementalDeltas rejects a single dump and oversize chunks", () => {
  assert.equal(isIncrementalDeltas([24]), false);
  assert.equal(isIncrementalDeltas([2, 8, 3, 5, 5, 1]), true);
  assert.equal(isIncrementalDeltas([2, 200, 3], { maxChunkChars: 64 }), false);
});

test("isBurstyGaps flags long quiet stretches between deltas", () => {
  assert.equal(isBurstyGaps([50, 65, 49]), false);
  assert.equal(isBurstyGaps([50, 1200, 49]), true);
  assert.equal(isBurstyGaps([50, 1200], { maxQuietMs: 2000 }), false);
});

test("paint before the first delta still records firstPaintMs", () => {
  const turn = createStreamTurnTrace("early-paint", 0);
  turn.paint(0, 22);
  turn.delta(3, 100);
  const snapshot = turn.settled(200);
  assert.equal(firstPaintMs(snapshot), 22);
  assert.equal(firstDeltaMs(snapshot), 100);
});

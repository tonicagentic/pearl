import assert from "node:assert/strict";
import { test } from "node:test";

import {
  formatDurationMs,
  turnEventSpan,
} from "../mobile/src/turn-duration.ts";

test("turnEventSpan uses first and last turn-scoped event timestamps", () => {
  const span = turnEventSpan(
    [
      {
        type: "delivery.consumed",
        data: { turnId: "t1" },
        meta: { at: "2026-01-01T00:00:00.000Z" },
      },
      {
        type: "turn.started",
        data: { turnId: "t1" },
        meta: { at: "2026-01-01T00:00:10.000Z" },
      },
      {
        type: "content.delta",
        data: { turnId: "t1" },
        meta: { at: "2026-01-01T00:00:15.000Z" },
      },
      {
        type: "turn.settled",
        data: { turnId: "t1" },
        meta: { at: "2026-01-01T00:00:22.000Z" },
      },
      {
        type: "turn.started",
        data: { turnId: "t2" },
        meta: { at: "2026-01-01T00:01:00.000Z" },
      },
    ],
    "t1",
  );
  assert.ok(span);
  assert.equal(span.startMs, Date.parse("2026-01-01T00:00:10.000Z"));
  assert.equal(span.endMs, Date.parse("2026-01-01T00:00:22.000Z"));
  assert.equal(formatDurationMs(span.endMs - span.startMs), "12s");
});

test("turnEventSpan ignores other turns and missing ids", () => {
  assert.equal(turnEventSpan([], "t1"), undefined);
  assert.equal(
    turnEventSpan(
      [{ type: "turn.started", data: { turnId: "t2" }, meta: { at: "2026-01-01T00:00:00.000Z" } }],
      "t1",
    ),
    undefined,
  );
});

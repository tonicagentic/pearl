import assert from "node:assert/strict";
import { test } from "node:test";

import {
  collectTurnTimestamps,
  createTurnTimestampCache,
} from "../lib/chat/turn-timestamps.ts";

const TURN = "turn_ts";
const USER_AT = "2026-01-02T10:00:01.000Z";
const ASSISTANT_AT = "2026-01-02T10:02:00.000Z";

const turnEvents = [
  {
    type: "turn.started",
    data: {
      turnId: TURN,
      cause: { deliveryId: "delivery_1" },
      follows: null,
    },
    meta: {
      at: "2026-01-02T10:00:00.000Z",
      position: { line: 0, index: 0 },
    },
  },
  {
    type: "delivery.consumed",
    data: {
      deliveryId: "delivery_1",
      turnId: TURN,
      parts: [{ kind: "text", text: "hi" }],
    },
    meta: { at: USER_AT, position: { line: 1, index: 0 } },
  },
  {
    type: "model.requested",
    data: { runId: "run_1", owner: { turnId: TURN } },
    scope: { turnId: TURN },
    meta: { at: ASSISTANT_AT, position: { line: 2, index: 0 } },
  },
];

test("collectTurnTimestamps stamps user and assistant from the event log", () => {
  const cache = createTurnTimestampCache();
  const stamps = collectTurnTimestamps(turnEvents, cache);
  assert.equal(stamps.get(TURN)?.user?.toISOString(), USER_AT);
  assert.equal(stamps.get(TURN)?.assistant?.toISOString(), ASSISTANT_AT);
});

test("missing meta.at does not invent a durable time", () => {
  const cache = createTurnTimestampCache();
  const stamps = collectTurnTimestamps(
    [
      {
        type: "delivery.consumed",
        data: {
          deliveryId: "d1",
          turnId: "t1",
          parts: [{ kind: "text", text: "hi" }],
        },
        meta: { position: { line: 0, index: 0 } },
      },
      {
        type: "model.requested",
        data: { runId: "r1", owner: { turnId: "t1" } },
        scope: { turnId: "t1" },
        meta: { position: { line: 1, index: 0 } },
      },
    ],
    cache,
  );
  assert.equal(stamps.get("t1"), undefined);
});

test("empty delivery.consumed parts are ignored", () => {
  const cache = createTurnTimestampCache();
  const stamps = collectTurnTimestamps(
    [
      {
        type: "delivery.consumed",
        data: { deliveryId: "d1", turnId: "t1", parts: [] },
        meta: { at: USER_AT },
      },
    ],
    cache,
  );
  assert.equal(stamps.get("t1"), undefined);
});

test("resumes an append-only scan without rewriting earlier stamps", () => {
  const cache = createTurnTimestampCache();
  const first = collectTurnTimestamps(turnEvents, cache);
  const user = first.get(TURN)?.user;
  const next = [
    ...turnEvents,
    {
      type: "model.started",
      data: { runId: "run_1" },
      scope: { turnId: TURN },
      meta: { at: "2026-01-02T10:03:00.000Z" },
    },
  ];
  const second = collectTurnTimestamps(next, cache);
  assert.equal(second.get(TURN)?.user, user);
  assert.equal(second.get(TURN)?.assistant?.toISOString(), ASSISTANT_AT);
});

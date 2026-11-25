import assert from "node:assert/strict";
import { test } from "node:test";

import { turnEndedWithoutAssistant } from "../lib/chat/empty-turn.ts";

test("turnEndedWithoutAssistant when turn settled with only a user row", () => {
  assert.equal(
    turnEndedWithoutAssistant(
      [
        { type: "delivery.consumed" },
        { type: "turn.started" },
        { type: "turn.settled" },
      ],
      [{ role: "user" }],
      false,
    ),
    true,
  );
});

test("turnEndedWithoutAssistant is false while busy or after assistant", () => {
  const events = [
    { type: "turn.started" },
    { type: "turn.settled" },
  ];
  assert.equal(
    turnEndedWithoutAssistant(events, [{ role: "user" }], true),
    false,
  );
  assert.equal(
    turnEndedWithoutAssistant(
      events,
      [{ role: "user" }, { role: "assistant" }],
      false,
    ),
    false,
  );
});
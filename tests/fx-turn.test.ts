import assert from "node:assert/strict";
import test from "node:test";

import {
  awaitDurableFxTurn,
  isFxStreamEndedError,
} from "../lib/apps/fx-turn.ts";

function ndjsonStream(lines: readonly unknown[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let index = 0;
  return new ReadableStream({
    pull(controller) {
      if (index >= lines.length) {
        controller.close();
        return;
      }
      const line = `${JSON.stringify(lines[index])}\n`;
      index += 1;
      controller.enqueue(encoder.encode(line));
    },
  });
}

test("isFxStreamEndedError matches libfx viewer drop", () => {
  assert.equal(
    isFxStreamEndedError(
      new Error("the session stream ended before the turn did"),
    ),
    true,
  );
  assert.equal(isFxStreamEndedError(new Error("other")), false);
});

test("awaitDurableFxTurn collects events until turn_end", async () => {
  const session = {
    stream() {
      return ndjsonStream([
        { type: "turn_start", messageId: "m1", sessionId: "s1", cursor: 1 },
        { type: "text", messageId: "m1", text: "hello", cursor: 2 },
        {
          type: "turn_end",
          messageId: "m1",
          stopReason: "end_turn",
          cursor: 3,
        },
      ]);
    },
  };
  const turn = {
    messageId: "m1",
    accepted: Promise.resolve({ messageId: "m1" }),
  };
  const outcome = await awaitDurableFxTurn(session, turn);
  assert.equal(outcome.result.stopReason, "end_turn");
  assert.equal(outcome.events.length, 1);
  assert.equal(outcome.events[0]?.type, "text");
});

test("awaitDurableFxTurn reconnects after stream drop mid-turn", async () => {
  let calls = 0;
  const session = {
    stream(cursor = 0) {
      calls += 1;
      if (calls === 1) {
        return ndjsonStream([
          { type: "turn_start", messageId: "m1", sessionId: "s1", cursor: 1 },
          { type: "text", messageId: "m1", text: "part-1", cursor: 2 },
        ]);
      }
      assert.equal(cursor, 2);
      return ndjsonStream([
        { type: "turn_resume", messageId: "m1", sessionId: "s1", cursor: 3 },
        { type: "text", messageId: "m1", text: "part-2", cursor: 4 },
        {
          type: "turn_end",
          messageId: "m1",
          stopReason: "end_turn",
          cursor: 5,
        },
      ]);
    },
  };
  const turn = {
    messageId: "m1",
    accepted: Promise.resolve({ messageId: "m1" }),
  };
  const outcome = await awaitDurableFxTurn(session, turn);
  assert.equal(calls, 2);
  assert.equal(outcome.result.stopReason, "end_turn");
  assert.deepEqual(
    outcome.events.map((event) => event.text),
    ["part-1", "part-2"],
  );
});

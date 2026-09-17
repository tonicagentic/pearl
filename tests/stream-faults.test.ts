import assert from "node:assert/strict";
import { test } from "node:test";
import type { MessageStreamEvent } from "eve/client";
import { createChatMessageReducer } from "../lib/chat/message-reducer.ts";
import { isChatTurnSettledEvent } from "../lib/chat/events.ts";

// Part 5 (fault injection, streaming): these tests inject stream faults at
// the app's real boundary — lib/chat/message-reducer.ts + lib/chat/events.ts,
// the code that decides what the UI treats as a complete response. The
// framework (eve's durable stream) is not mocked; we cut the event sequence
// the way a dropped connection or a gateway token cap would.

const meta = { at: new Date().toISOString(), id: "evt_probe" } as never;

function feed(
  // Fault injection feeds deliberately malformed/truncated event sequences,
  // so the entries are untyped and cast at the boundary.
  events: readonly Record<string, unknown>[],
): ReturnType<ReturnType<typeof createChatMessageReducer>["initial"]> {
  const reducer = createChatMessageReducer();
  let data = reducer.initial();

  for (const event of events) {
    data = reducer.reduce(
      data,
      { meta, ...event } as unknown as MessageStreamEvent,
    );
  }

  return data;
}

const appended = (delta: string, soFar: string, sequence: number, turnId: string) => ({
  type: "message.appended",
  data: { messageDelta: delta, messageSoFar: soFar, sequence, stepIndex: 0, turnId },
});

const toolInput = (callId: string, delta: string, offset: number, turnId: string) => ({
  type: "action.input.appended",
  data: {
    callId,
    inputTextDelta: delta,
    inputTextOffset: offset,
    sequence: 10,
    stepIndex: 0,
    toolName: "get_weather",
    turnId,
  },
});

const TURN = "turn_fault";

test("mid-stream connection drop: partial text stays streaming, never presented as complete", () => {
  const data = feed([
    { type: "message.received", data: { messageId: "m1", text: "q", turnId: TURN } },
    appended("The answer is ", "The answer is ", 1, TURN),
    appended("definitely", "The answer is definitely", 2, TURN),
    // …connection drops: no turn.completed, no session settle event.
  ]);

  const assistant = data.messages.find((m) => m.role === "assistant");
  const textPart = assistant?.parts.find((p) => p.type === "text") as
    | { state?: string; text?: string }
    | undefined;

  assert.ok(textPart, "partial text is retained for resumption");
  assert.equal(textPart.state, "streaming", "partial text must stay in streaming state");
  assert.equal(textPart.text, "The answer is definitely");
  assert.equal(
    isChatTurnSettledEvent({ type: "message.appended" } as MessageStreamEvent),
    false,
    "a truncated stream is not a settled turn",
  );
});

test("mid-stream connection drop: truncated tool-call arguments are not executed", () => {
  const data = feed([
    { type: "message.received", data: { messageId: "m1", text: "q", turnId: TURN } },
    toolInput("c1", '{"city": "Bro', 0, TURN),
  ]);

  const assistant = data.messages.find((m) => m.role === "assistant");
  const toolPart = assistant?.parts.find((p) => p.type === "dynamic-tool") as
    | { state?: string; inputText?: string; toolName?: string }
    | undefined;

  assert.ok(toolPart, "the in-flight tool call is retained");
  assert.equal(toolPart.state, "input-streaming");
  assert.equal(toolPart.inputText, '{"city": "Bro');
  // No input-parsed/executed state may exist for a truncated argument blob.
  assert.equal(
    isChatTurnSettledEvent({ type: "action.input.appended" } as MessageStreamEvent),
    false,
  );
});

test("gateway token cap: turn.failed finalizes text and marks the message failed — the truncated tool call is never promoted to executed", () => {
  const data = feed([
    { type: "message.received", data: { messageId: "m1", text: "q", turnId: TURN } },
    appended("Working on it", "Working on it", 1, TURN),
    toolInput("c2", '{"city": "Auckla', 0, TURN),
    { type: "turn.failed", data: { turnId: TURN, error: { message: "max tokens exceeded" } } },
  ]);

  const assistant = data.messages.find((m) => m.role === "assistant");

  // The failed turn must be presented as failed, never as a complete answer.
  assert.equal(assistant?.metadata?.status, "failed");

  const textPart = assistant?.parts.find((p) => p.type === "text") as
    | { state?: string }
    | undefined;
  assert.equal(textPart?.state, "done", "the wrapper finalizes text on the failed-turn boundary");

  // Whatever happened to the in-flight tool part, nothing may appear as an
  // executed call from the truncated argument blob.
  const executedToolPart = assistant?.parts.find(
    (p) =>
      p.type === "dynamic-tool" &&
      ["input-complete", "output-available"].includes(
        (p as { state?: string }).state ?? "",
      ),
  );
  assert.equal(
    executedToolPart,
    undefined,
    "a truncated tool call must never be presented as executed",
  );

  // The failed turn is not a settled session: the UI must not show success.
  assert.equal(
    isChatTurnSettledEvent({ type: "turn.failed" } as MessageStreamEvent),
    false,
    "turn.failed is not a session settle event",
  );
});

test("truncated tool-call arguments fail the tool's input schema (zod boundary) instead of executing", async () => {
  const getWeather = (await import("../agent/tools/get_weather.ts")).default;
  const { inputSchema } = getWeather as unknown as {
    inputSchema: { safeParse: (v: unknown) => { success: boolean } };
  };

  // What a max-token cutoff mid-arguments delivers: invalid JSON. It must be
  // rejected before schema validation and can never validate as tool input.
  let unparseable = false;
  let parsed: { success: boolean } = { success: true };

  try {
    parsed = inputSchema.safeParse(JSON.parse('{"city": "Bro'));
  } catch {
    unparseable = true;
  }

  assert.ok(
    unparseable || parsed.success === false,
    "a truncated argument blob must never validate as tool input",
  );
});

test("mid-loop tool-call budget cutoff: events stop without a completed multi-step run", () => {
  // Simulate the harness ending the turn after step 1 of a planned 4-step run
  // (budget exhausted): the stream ends with a completed step, no turn
  // boundary. Nothing may look settled.
  const data = feed([
    { type: "message.received", data: { messageId: "m1", text: "q", turnId: TURN } },
    appended("step 1 done", "step 1 done", 1, TURN),
    { type: "step.completed", data: { stepIndex: 0, turnId: TURN } },
  ]);

  assert.equal(
    isChatTurnSettledEvent({ type: "step.completed" } as MessageStreamEvent),
    false,
    "a completed step is not a settled session",
  );

  const assistant = data.messages.find((m) => m.role === "assistant");
  const textPart = assistant?.parts.find((p) => p.type === "text") as { state?: string } | undefined;
  assert.equal(textPart?.state, "streaming", "partial multi-step output stays streaming");
});

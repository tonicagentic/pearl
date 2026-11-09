import assert from "node:assert/strict";
import { test } from "node:test";
import { conversationOf, type ConversationState, type SessionStreamEvent } from "eve/client";
import { failure } from "eve/events";
import { isChatTurnSettledEvent } from "../lib/chat/events.ts";

// Part 5 (fault injection, streaming): these tests inject stream faults at
// the app's real boundary — eve's conversation projection + lib/chat/events.ts,
// the code that decides what the UI treats as a complete response. The
// framework (eve's durable stream) is not mocked; we cut the event sequence
// the way a dropped connection or a gateway token cap would.

type RawEvent = {
  readonly type: string;
  readonly scope?: Record<string, string>;
  readonly data: Record<string, unknown>;
};

function feed(
  // Fault injection feeds deliberately truncated event sequences, so the
  // entries are untyped and cast at the boundary.
  events: readonly RawEvent[],
): ConversationState {
  return conversationOf(
    events.map((event, line) => ({
      ...event,
      meta: { at: new Date().toISOString(), position: { index: 0, line } },
    })) as unknown as SessionStreamEvent[],
  );
}

const TURN = "turn_fault";
const RUN = "run_fault";
const turnScope = { turnId: TURN };
const runScope = { runId: RUN, turnId: TURN };

const turnStart = (): RawEvent[] => [
  { type: "session.started", data: {} },
  { type: "delivery.admitted", data: { deliveryId: "d1" } },
  {
    type: "delivery.consumed",
    scope: turnScope,
    data: { deliveryId: "d1", turnId: TURN, parts: [{ kind: "text", text: "q" }] },
  },
  {
    type: "turn.started",
    scope: turnScope,
    data: { turnId: TURN, cause: { deliveryId: "d1" }, follows: null },
  },
  { type: "model.requested", scope: turnScope, data: { runId: RUN, owner: { turnId: TURN } } },
  {
    type: "model.started",
    scope: runScope,
    data: { runId: RUN, modelId: "test-model", attempt: 0 },
  },
];

const textDelta = (delta: string, first = false): RawEvent => ({
  type: "content.delta",
  scope: runScope,
  data: { partId: "p1", delta, ...(first ? { kind: "text" } : {}) },
});

const toolInput = (callId: string, delta: string, first = false): RawEvent => ({
  type: "call.input",
  scope: runScope,
  data: { callId, delta, ...(first ? { kind: "tool", name: "get_weather" } : {}) },
});

const assistantOf = (data: ConversationState) =>
  data.messages.find((message) => message.role === "assistant");

test("mid-stream connection drop: partial text stays streaming, never presented as complete", () => {
  const data = feed([
    ...turnStart(),
    textDelta("The answer is ", true),
    textDelta("definitely"),
    // …connection drops: no turn.settled, no session.ended.
  ]);

  const assistant = assistantOf(data);
  const textPart = assistant?.parts.find((p) => p.type === "text");

  assert.ok(textPart && textPart.type === "text", "partial text is retained for resumption");
  assert.equal(textPart.state, "streaming", "partial text must stay in streaming state");
  assert.equal(textPart.text, "The answer is definitely");
  assert.equal(assistant?.metadata?.status, "streaming");
  assert.equal(
    isChatTurnSettledEvent({ type: "content.delta" } as SessionStreamEvent),
    false,
    "a truncated stream is not a settled turn",
  );
});

test("mid-stream connection drop: truncated tool-call arguments are not executed", () => {
  const data = feed([...turnStart(), toolInput("c1", '{"city": "Bro', true)]);

  const toolPart = assistantOf(data)?.parts.find((p) => p.type === "tool");

  assert.ok(toolPart && toolPart.type === "tool", "the in-flight tool call is retained");
  assert.equal(toolPart.state, "streaming");
  assert.equal(toolPart.inputText, '{"city": "Bro');
  assert.equal(
    isChatTurnSettledEvent({ type: "call.input" } as SessionStreamEvent),
    false,
  );
});

test("gateway token cap: a failed turn is never presented as a complete answer — the truncated tool call is never promoted to executed", () => {
  const events = [
    ...turnStart(),
    textDelta("Working on it", true),
    toolInput("c2", '{"city": "Auckla', true),
    {
      type: "model.settled",
      scope: runScope,
      data: {
        runId: RUN,
        outcome: "failed",
        error: { code: "max_tokens", message: "max tokens exceeded" },
      },
    },
    {
      type: "turn.settled",
      scope: turnScope,
      data: {
        turnId: TURN,
        outcome: "failed",
        error: { code: "max_tokens", message: "max tokens exceeded" },
      },
    },
  ];
  const data = feed(events);
  const assistant = assistantOf(data);

  // Nothing may be left streaming once the turn failed.
  assert.notEqual(assistant?.metadata?.status, "streaming");
  for (const part of assistant?.parts ?? []) {
    if (part.type === "text" || part.type === "reasoning") {
      assert.notEqual(part.state, "streaming");
    }
  }

  // The failure stays readable from the session view, which drives the
  // error banner.
  assert.equal(failure(data.view, TURN)?.message, "max tokens exceeded");

  // Whatever happened to the in-flight tool part, nothing may appear as an
  // executed call from the truncated argument blob.
  const executedToolPart = assistant?.parts.find(
    (p) => p.type === "tool" && ["completed", "running"].includes(p.state),
  );
  assert.equal(
    executedToolPart,
    undefined,
    "a truncated tool call must never be presented as executed",
  );

  assert.equal(
    isChatTurnSettledEvent({ type: "model.settled" } as SessionStreamEvent),
    false,
    "a failed model run is not a settled turn",
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
  // Simulate the harness ending the stream after step 1 of a planned 4-step
  // run (budget exhausted): the model run settled, no turn boundary. Nothing
  // may look settled.
  const data = feed([
    ...turnStart(),
    textDelta("step 1 done", true),
    { type: "model.settled", scope: runScope, data: { runId: RUN, outcome: "completed" } },
  ]);

  assert.equal(
    isChatTurnSettledEvent({ type: "model.settled" } as SessionStreamEvent),
    false,
    "a settled model run is not a settled turn",
  );

  assert.notEqual(
    assistantOf(data)?.metadata?.status,
    "complete",
    "partial multi-step output is not presented as complete",
  );
});

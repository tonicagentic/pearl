import assert from "node:assert/strict";
import { register } from "node:module";
import { test } from "node:test";
import { pathToFileURL } from "node:url";

// Resolve extensionless mobile / lib imports the same way as other mobile tests.
register("./mobile-ts-resolve.mjs", pathToFileURL("./tests/"));

const { conversationOf } = await import("eve/client");
const {
  asStreamEvents,
  minimalByType,
  STREAM_SCENARIOS,
} = await import("../mobile/src/chat/stream-event-fixtures.ts");
const { EVE_STREAM_EVENT_TYPES } = await import(
  "../mobile/src/chat/stream-event-contract.ts"
);
const { toThreadMessages } = await import("../mobile/src/message-projection.ts");
const { deriveSubagentRuns } = await import("../mobile/src/subagent-runs.ts");
const { deriveLiveThinkingState } = await import(
  "../lib/stream-thinking-state.ts"
);

test("folds every catalog type without throwing when attached to a turn prelude", () => {
  const prelude = [
    minimalByType["session.started"],
    minimalByType["delivery.admitted"],
    minimalByType["delivery.consumed"],
    minimalByType["turn.started"],
    minimalByType["model.requested"],
    minimalByType["model.started"],
  ];

  for (const type of EVE_STREAM_EVENT_TYPES) {
    const extra =
      type === "session.started" ||
      type === "delivery.admitted" ||
      type === "delivery.consumed" ||
      type === "turn.started" ||
      type === "model.requested" ||
      type === "model.started"
        ? []
        : [minimalByType[type]];

    const events = asStreamEvents([...prelude, ...extra]);
    const data = conversationOf(events);
    assert.doesNotThrow(() => toThreadMessages(data, { events }));
    assert.doesNotThrow(() =>
      deriveLiveThinkingState({
        events,
        parts: [],
        statusType: "running",
      }),
    );
    assert.doesNotThrow(() => deriveSubagentRuns(events, Date.now()));
  }
});

test("projects each scenario without throwing", () => {
  for (const scenario of STREAM_SCENARIOS) {
    const events = asStreamEvents(scenario.events);
    const data = conversationOf(events);
    assert.doesNotThrow(() => toThreadMessages(data, { events }));
    assert.doesNotThrow(() =>
      deriveLiveThinkingState({
        events,
        parts: [],
        statusType: "running",
      }),
    );
    assert.doesNotThrow(() => deriveSubagentRuns(events, Date.now()));
  }
});

test("happy-reply yields an assistant message", () => {
  const scenario = STREAM_SCENARIOS.find((s) => s.id === "happy-reply");
  assert.ok(scenario);
  const events = asStreamEvents(scenario.events);
  const data = conversationOf(events);
  const thread = toThreadMessages(data, { events });
  assert.ok(thread.some((m) => m.role === "assistant"));
});

test("hitl-question projects without crashing", () => {
  const scenario = STREAM_SCENARIOS.find((s) => s.id === "hitl-question");
  assert.ok(scenario);
  const events = asStreamEvents(scenario.events);
  const data = conversationOf(events);
  assert.doesNotThrow(() => toThreadMessages(data, { events }));
});

test("response.* usage.recorded and child.sent stay projection-safe", () => {
  const scenario = STREAM_SCENARIOS.find((s) => s.id === "usage-and-child-sent");
  assert.ok(scenario);
  const events = asStreamEvents(scenario.events);
  const data = conversationOf(events);
  const thread = toThreadMessages(data, { events });
  assert.ok(Array.isArray(thread));
  assert.ok(events.some((e) => e.type === "child.sent"));
  assert.ok(events.some((e) => e.type === "usage.recorded"));
});

test("mid-stream-drop leaves no turn.settled", () => {
  const scenario = STREAM_SCENARIOS.find((s) => s.id === "mid-stream-drop");
  assert.ok(scenario);
  const events = asStreamEvents(scenario.events);
  const data = conversationOf(events);
  assert.equal(
    events.some((e) => e.type === "turn.settled"),
    false,
  );
  assert.doesNotThrow(() => toThreadMessages(data, { events }));
});

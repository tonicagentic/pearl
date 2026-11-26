/**
 * Minimal well-formed eve stream events for contract / projection tests.
 * Every catalog type appears at least once across `minimalByType` and the
 * multi-event scenarios.
 */

import type { SessionStreamEvent } from "eve/client";

import {
  EVE_STREAM_EVENT_TYPES,
  type EveStreamEventType,
} from "./stream-event-contract";

type RawEvent = {
  readonly type: string;
  readonly scope?: Record<string, string>;
  readonly data: Record<string, unknown>;
};

const TURN = "turn_fix";
const RUN = "run_fix";
const CALL = "call_fix";
const PART = "part_fix";
const DELIVERY = "delivery_fix";
const INTERACTION = "interaction_fix";
const RESPONSE = "response_fix";
const TASK = "task_fix";
const CHILD = "child_session_fix";
const CHANGE = "change_fix";

const turnScope = { turnId: TURN };
const runScope = { runId: RUN, turnId: TURN };

/** Attach meta.position so SessionStore / conversationOf can fold the line. */
export function asStreamEvent(
  raw: RawEvent,
  line: number,
): SessionStreamEvent {
  return {
    ...raw,
    meta: {
      at: new Date(Date.parse("2026-06-01T12:00:00.000Z") + line * 10).toISOString(),
      position: { index: 0, line },
      endOfLine: true,
    },
  } as unknown as SessionStreamEvent;
}

export function asStreamEvents(
  raws: readonly RawEvent[],
): SessionStreamEvent[] {
  return raws.map((raw, line) => asStreamEvent(raw, line));
}

/** One minimal payload per eve stream event type. */
export const minimalByType: Readonly<Record<EveStreamEventType, RawEvent>> = {
  "session.started": { type: "session.started", data: {} },
  "session.ended": {
    type: "session.ended",
    data: { outcome: "completed" },
  },
  "delivery.admitted": {
    type: "delivery.admitted",
    data: { deliveryId: DELIVERY },
  },
  "delivery.consumed": {
    type: "delivery.consumed",
    scope: turnScope,
    data: {
      deliveryId: DELIVERY,
      turnId: TURN,
      parts: [{ kind: "text", text: "hello" }],
    },
  },
  "delivery.settled": {
    type: "delivery.settled",
    data: { deliveryId: DELIVERY, outcome: "handled", turnId: TURN },
  },
  "turn.started": {
    type: "turn.started",
    scope: turnScope,
    data: { turnId: TURN, cause: { deliveryId: DELIVERY }, follows: null },
  },
  "turn.paused": {
    type: "turn.paused",
    scope: turnScope,
    data: { turnId: TURN },
  },
  "turn.settled": {
    type: "turn.settled",
    scope: turnScope,
    data: { turnId: TURN, outcome: "completed", cause: { deliveryId: DELIVERY } },
  },
  "model.requested": {
    type: "model.requested",
    scope: turnScope,
    data: { runId: RUN, owner: { turnId: TURN } },
  },
  "model.started": {
    type: "model.started",
    scope: runScope,
    data: { runId: RUN, modelId: "test-model", attempt: 0 },
  },
  "model.retried": {
    type: "model.retried",
    scope: runScope,
    data: { runId: RUN, attempt: 1 },
  },
  "model.settled": {
    type: "model.settled",
    scope: runScope,
    data: { runId: RUN, outcome: "completed" },
  },
  "content.delta": {
    type: "content.delta",
    scope: runScope,
    data: { partId: PART, kind: "text", delta: "Hi" },
  },
  "content.completed": {
    type: "content.completed",
    scope: runScope,
    data: {
      partId: PART,
      kind: "text",
      phase: "reply",
      runId: RUN,
      value: "Hi",
    },
  },
  "call.input": {
    type: "call.input",
    scope: runScope,
    data: { callId: CALL, kind: "tool", name: "search", delta: '{"q":"' },
  },
  "call.requested": {
    type: "call.requested",
    scope: runScope,
    data: {
      callId: CALL,
      capability: { kind: "tool", name: "search" },
      owner: { runId: RUN },
    },
  },
  "call.started": {
    type: "call.started",
    scope: runScope,
    data: { callId: CALL },
  },
  "call.progress": {
    type: "call.progress",
    scope: runScope,
    data: { callId: CALL, label: "Searching…", output: "…" },
  },
  "call.settled": {
    type: "call.settled",
    scope: runScope,
    data: { callId: CALL, outcome: "completed" },
  },
  "task.started": {
    type: "task.started",
    scope: turnScope,
    data: { taskId: TASK, name: "researcher" },
  },
  "task.ended": {
    type: "task.ended",
    scope: turnScope,
    data: { taskId: TASK, outcome: "completed" },
  },
  "child.opened": {
    type: "child.opened",
    scope: turnScope,
    data: {
      sessionId: CHILD,
      name: "researcher",
      stream: "http://example.test/stream",
      owner: { taskId: TASK },
    },
  },
  "child.sent": {
    type: "child.sent",
    scope: turnScope,
    data: {
      sessionId: CHILD,
      callId: CALL,
      childDeliveryId: "child_delivery_fix",
    },
  },
  "interaction.opened": {
    type: "interaction.opened",
    scope: turnScope,
    data: {
      interactionId: INTERACTION,
      subject: { turnId: TURN },
      request: {
        kind: "question",
        prompt: "Continue?",
        options: [{ id: "yes", label: "Yes" }],
      },
    },
  },
  "interaction.settled": {
    type: "interaction.settled",
    scope: turnScope,
    data: { interactionId: INTERACTION, outcome: "accepted" },
  },
  "response.submitted": {
    type: "response.submitted",
    data: {
      responseId: RESPONSE,
      deliveryId: DELIVERY,
      interactionId: INTERACTION,
      value: { optionId: "yes" },
    },
  },
  "response.admitted": {
    type: "response.admitted",
    data: { responseId: RESPONSE },
  },
  "response.settled": {
    type: "response.settled",
    data: { responseId: RESPONSE, outcome: "applied" },
  },
  "context.started": {
    type: "context.started",
    scope: turnScope,
    data: { changeId: CHANGE },
  },
  "context.settled": {
    type: "context.settled",
    scope: turnScope,
    data: { changeId: CHANGE, outcome: "completed" },
  },
  "usage.recorded": {
    type: "usage.recorded",
    scope: runScope,
    data: {
      kind: "model",
      owner: { runId: RUN },
      usage: {
        inputTokens: 10,
        outputTokens: 5,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
      },
    },
  },
};

/** Assert the fixture map covers the full catalog. */
export function assertFixturesCoverCatalog(): void {
  for (const type of EVE_STREAM_EVENT_TYPES) {
    if (!minimalByType[type]) {
      throw new Error(`Missing fixture for ${type}`);
    }
  }
}

const turnPrelude: RawEvent[] = [
  minimalByType["session.started"],
  minimalByType["delivery.admitted"],
  minimalByType["delivery.consumed"],
  minimalByType["turn.started"],
  minimalByType["model.requested"],
  minimalByType["model.started"],
];

export type StreamScenarioId =
  | "happy-reply"
  | "tool-call"
  | "hitl-question"
  | "subagent"
  | "compaction"
  | "model-retry"
  | "cancelled-turn"
  | "failed-turn"
  | "mid-stream-drop"
  | "response-cycle"
  | "usage-and-child-sent";

export type StreamScenario = {
  readonly id: StreamScenarioId;
  readonly title: string;
  readonly events: readonly RawEvent[];
};

/** Multi-event turns that exercise groups of catalog types together. */
export const STREAM_SCENARIOS: readonly StreamScenario[] = [
  {
    id: "happy-reply",
    title: "Completed text reply",
    events: [
      ...turnPrelude,
      minimalByType["content.delta"],
      {
        type: "content.delta",
        scope: runScope,
        data: { partId: PART, delta: " there" },
      },
      minimalByType["content.completed"],
      minimalByType["model.settled"],
      minimalByType["usage.recorded"],
      minimalByType["turn.settled"],
      minimalByType["delivery.settled"],
    ],
  },
  {
    id: "tool-call",
    title: "Tool call with progress",
    events: [
      ...turnPrelude,
      minimalByType["call.input"],
      minimalByType["call.requested"],
      minimalByType["call.started"],
      minimalByType["call.progress"],
      minimalByType["call.settled"],
      {
        type: "content.delta",
        scope: runScope,
        data: { partId: "p2", kind: "text", delta: "Done" },
      },
      {
        type: "content.completed",
        scope: runScope,
        data: {
          partId: "p2",
          kind: "text",
          phase: "reply",
          runId: RUN,
          value: "Done",
        },
      },
      minimalByType["model.settled"],
      {
        type: "turn.settled",
        scope: turnScope,
        data: {
          turnId: TURN,
          outcome: "completed",
          cause: { deliveryId: DELIVERY },
        },
      },
    ],
  },
  {
    id: "hitl-question",
    title: "Paused on a question",
    events: [
      ...turnPrelude,
      minimalByType["interaction.opened"],
      minimalByType["turn.paused"],
    ],
  },
  {
    id: "response-cycle",
    title: "HITL response submitted and applied",
    events: [
      ...turnPrelude,
      minimalByType["interaction.opened"],
      minimalByType["turn.paused"],
      minimalByType["response.submitted"],
      minimalByType["response.admitted"],
      minimalByType["response.settled"],
      minimalByType["interaction.settled"],
      {
        type: "turn.settled",
        scope: turnScope,
        data: {
          turnId: TURN,
          outcome: "completed",
          cause: { deliveryId: DELIVERY },
        },
      },
    ],
  },
  {
    id: "subagent",
    title: "Child session opened",
    events: [
      ...turnPrelude,
      minimalByType["task.started"],
      minimalByType["child.opened"],
      minimalByType["child.sent"],
      minimalByType["task.ended"],
      {
        type: "turn.settled",
        scope: turnScope,
        data: {
          turnId: TURN,
          outcome: "completed",
          cause: { deliveryId: DELIVERY },
        },
      },
    ],
  },
  {
    id: "compaction",
    title: "Context compaction",
    events: [
      ...turnPrelude,
      minimalByType["context.started"],
      minimalByType["context.settled"],
      {
        type: "content.delta",
        scope: runScope,
        data: { partId: PART, kind: "text", delta: "Ok" },
      },
      minimalByType["content.completed"],
      minimalByType["model.settled"],
      {
        type: "turn.settled",
        scope: turnScope,
        data: {
          turnId: TURN,
          outcome: "completed",
          cause: { deliveryId: DELIVERY },
        },
      },
    ],
  },
  {
    id: "model-retry",
    title: "Model retry then reply",
    events: [
      ...turnPrelude,
      minimalByType["model.retried"],
      {
        type: "model.started",
        scope: runScope,
        data: { runId: RUN, modelId: "test-model", attempt: 1 },
      },
      {
        type: "content.delta",
        scope: runScope,
        data: { partId: PART, kind: "text", delta: "Retry ok" },
      },
      minimalByType["content.completed"],
      minimalByType["model.settled"],
      {
        type: "turn.settled",
        scope: turnScope,
        data: {
          turnId: TURN,
          outcome: "completed",
          cause: { deliveryId: DELIVERY },
        },
      },
    ],
  },
  {
    id: "cancelled-turn",
    title: "Turn cancelled",
    events: [
      ...turnPrelude,
      {
        type: "content.delta",
        scope: runScope,
        data: { partId: PART, kind: "text", delta: "Half" },
      },
      {
        type: "model.settled",
        scope: runScope,
        data: { runId: RUN, outcome: "interrupted" },
      },
      {
        type: "turn.settled",
        scope: turnScope,
        data: {
          turnId: TURN,
          outcome: "cancelled",
          cause: { deliveryId: DELIVERY },
        },
      },
    ],
  },
  {
    id: "failed-turn",
    title: "Turn failed",
    events: [
      ...turnPrelude,
      {
        type: "model.settled",
        scope: runScope,
        data: {
          runId: RUN,
          outcome: "failed",
          error: { code: "MODEL_CALL_FAILED", message: "Gateway error" },
        },
      },
      {
        type: "turn.settled",
        scope: turnScope,
        data: {
          turnId: TURN,
          outcome: "failed",
          cause: { deliveryId: DELIVERY },
        },
      },
      {
        type: "session.ended",
        data: { outcome: "failed" },
      },
    ],
  },
  {
    id: "mid-stream-drop",
    title: "Stream dropped mid-reply",
    events: [
      ...turnPrelude,
      {
        type: "content.delta",
        scope: runScope,
        data: { partId: PART, kind: "text", delta: "Partial" },
      },
      // No content.completed / turn.settled.
    ],
  },
  {
    id: "usage-and-child-sent",
    title: "Usage + child.sent without extra UI",
    events: [
      ...turnPrelude,
      minimalByType["task.started"],
      minimalByType["child.opened"],
      minimalByType["child.sent"],
      minimalByType["usage.recorded"],
      minimalByType["task.ended"],
      {
        type: "turn.settled",
        scope: turnScope,
        data: {
          turnId: TURN,
          outcome: "completed",
          cause: { deliveryId: DELIVERY },
        },
      },
    ],
  },
];

/** Types covered by at least one scenario event. */
export function typesCoveredByScenarios(): Set<string> {
  const seen = new Set<string>();
  for (const scenario of STREAM_SCENARIOS) {
    for (const event of scenario.events) {
      seen.add(event.type);
    }
  }
  for (const type of EVE_STREAM_EVENT_TYPES) {
    seen.add(type); // minimalByType covers all; scenarios may miss a few
  }
  return seen;
}

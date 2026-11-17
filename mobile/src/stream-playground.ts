/**
 * Timed v27 eve stream fixtures for the mobile stream-playground screen.
 * Events feed through conversationOf → toThreadMessages so playback exercises
 * the real production projection + Thread pipeline.
 */

import {
  conversationOf,
  type ConversationState,
  type SessionStreamEvent,
} from "eve/client";

export type StreamPlayScenarioId =
  | "reasoning-tools"
  | "compaction-retry-subagent"
  | "rapid-burst";

export type TimedStreamEvent = {
  readonly atMs: number;
  readonly event: SessionStreamEvent;
};

export type StreamPlayScenario = {
  readonly id: StreamPlayScenarioId;
  readonly title: string;
  readonly description: string;
  readonly events: readonly TimedStreamEvent[];
};

type RawEvent = {
  readonly type: string;
  readonly scope?: Record<string, string>;
  readonly data: Record<string, unknown>;
  readonly meta?: { readonly at?: string };
};

const TURN = "turn_play";
const RUN = "run_play";
const turnScope = { turnId: TURN };
const runScope = { runId: RUN, turnId: TURN };

function stamp(
  events: readonly { readonly atMs: number; readonly raw: RawEvent }[],
): TimedStreamEvent[] {
  const base = Date.parse("2026-06-01T12:00:00.000Z");
  return events.map((entry, line) => ({
    atMs: entry.atMs,
    event: {
      ...entry.raw,
      meta: {
        at: new Date(base + entry.atMs).toISOString(),
        position: { index: 0, line },
      },
    } as unknown as SessionStreamEvent,
  }));
}

function turnPrelude(): { atMs: number; raw: RawEvent }[] {
  return [
    { atMs: 0, raw: { type: "session.started", data: {} } },
    {
      atMs: 20,
      raw: { type: "delivery.admitted", data: { deliveryId: "d1" } },
    },
    {
      atMs: 40,
      raw: {
        type: "delivery.consumed",
        scope: turnScope,
        data: {
          deliveryId: "d1",
          turnId: TURN,
          parts: [{ kind: "text", text: "Look into this for me." }],
        },
      },
    },
    {
      atMs: 60,
      raw: {
        type: "turn.started",
        scope: turnScope,
        data: { turnId: TURN, cause: { deliveryId: "d1" }, follows: null },
      },
    },
    {
      atMs: 80,
      raw: {
        type: "model.requested",
        scope: turnScope,
        data: { runId: RUN, owner: { turnId: TURN } },
      },
    },
    {
      atMs: 100,
      raw: {
        type: "model.started",
        scope: runScope,
        data: { runId: RUN, modelId: "test-model", attempt: 0 },
      },
    },
  ];
}

function reasoningToolsScript(): TimedStreamEvent[] {
  return stamp([
    ...turnPrelude(),
    {
      atMs: 400,
      raw: {
        type: "content.delta",
        scope: runScope,
        data: {
          partId: "r1",
          kind: "reasoning",
          delta: "**Gather context**\nNeed the right sources first.\n",
        },
      },
    },
    {
      atMs: 900,
      raw: {
        type: "content.delta",
        scope: runScope,
        data: {
          partId: "r1",
          delta: "\n**Draft outline**\nSketch the answer shape.\n",
        },
      },
    },
    {
      atMs: 1400,
      raw: {
        type: "call.input",
        scope: runScope,
        data: {
          callId: "c_search",
          kind: "tool",
          name: "web_search",
          delta: '{"query":"pearl agent thinking',
        },
      },
    },
    {
      atMs: 1700,
      raw: {
        type: "call.input",
        scope: runScope,
        data: { callId: "c_search", delta: ' states"}' },
      },
    },
    {
      atMs: 1850,
      raw: {
        type: "content.completed",
        scope: runScope,
        data: {
          partId: "r1",
          kind: "reasoning",
          phase: "reasoning",
          runId: RUN,
          value:
            "**Gather context**\nNeed the right sources first.\n\n**Draft outline**\nSketch the answer shape.\n",
        },
      },
    },
    {
      atMs: 1900,
      raw: {
        type: "call.requested",
        scope: runScope,
        data: {
          callId: "c_search",
          capability: { kind: "tool", name: "web_search" },
          owner: { runId: RUN },
          input: { query: "pearl agent thinking states" },
        },
      },
    },
    {
      atMs: 2000,
      raw: {
        type: "call.started",
        scope: runScope,
        data: { callId: "c_search" },
      },
    },
    {
      atMs: 2400,
      raw: {
        type: "call.progress",
        scope: runScope,
        data: {
          callId: "c_search",
          label: "Searching the web",
          output: { status: "running" },
        },
      },
    },
    {
      atMs: 3200,
      raw: {
        type: "call.settled",
        scope: runScope,
        data: {
          callId: "c_search",
          outcome: "completed",
          output: { results: [{ title: "Thinking states" }] },
          label: "Finished search",
        },
      },
    },
    {
      atMs: 3600,
      raw: {
        type: "content.delta",
        scope: runScope,
        data: {
          partId: "t1",
          kind: "text",
          delta: "Here is what I found about thinking states.",
        },
      },
    },
    {
      atMs: 4000,
      raw: {
        type: "content.completed",
        scope: runScope,
        data: {
          partId: "t1",
          kind: "text",
          phase: "reply",
          runId: RUN,
          value: "Here is what I found about thinking states.",
        },
      },
    },
    {
      atMs: 4200,
      raw: {
        type: "turn.settled",
        scope: turnScope,
        data: { turnId: TURN, outcome: "completed" },
      },
    },
  ]);
}

function compactionRetrySubagentScript(): TimedStreamEvent[] {
  return stamp([
    ...turnPrelude(),
    {
      atMs: 300,
      raw: {
        type: "context.started",
        scope: turnScope,
        data: { changeId: "ctx1" },
      },
    },
    {
      atMs: 900,
      raw: {
        type: "context.settled",
        scope: turnScope,
        data: { changeId: "ctx1", outcome: "completed" },
      },
    },
    {
      atMs: 1100,
      raw: {
        type: "model.retried",
        scope: runScope,
        data: { runId: RUN, attempt: 1, reason: "timeout" },
      },
    },
    {
      atMs: 1400,
      raw: {
        type: "model.started",
        scope: runScope,
        data: { runId: RUN, modelId: "test-model", attempt: 1 },
      },
    },
    {
      atMs: 1800,
      raw: {
        type: "task.started",
        scope: turnScope,
        data: {
          kind: "background",
          name: "editor",
          taskId: "task_editor",
          startedBy: { callId: "c_editor" },
        },
      },
    },
    {
      atMs: 2000,
      raw: {
        type: "child.opened",
        scope: turnScope,
        data: {
          name: "editor",
          sessionId: "sess_editor",
          stream: "https://example.test/stream",
          owner: { taskId: "task_editor" },
        },
      },
    },
    {
      atMs: 2800,
      raw: {
        type: "task.ended",
        scope: turnScope,
        data: { taskId: "task_editor", outcome: "completed" },
      },
    },
    {
      atMs: 3200,
      raw: {
        type: "content.delta",
        scope: runScope,
        data: {
          partId: "t1",
          kind: "text",
          delta: "The editor finished the pass.",
        },
      },
    },
    {
      atMs: 3600,
      raw: {
        type: "turn.settled",
        scope: turnScope,
        data: { turnId: TURN, outcome: "completed" },
      },
    },
  ]);
}

function rapidBurstScript(): TimedStreamEvent[] {
  const headings = [
    "Scan inbox",
    "Rank urgency",
    "Draft reply",
    "Check calendar",
    "Propose times",
    "Confirm tone",
  ];
  const events: { atMs: number; raw: RawEvent }[] = [...turnPrelude()];
  let t = 200;
  for (const [index, heading] of headings.entries()) {
    events.push({
      atMs: t,
      raw: {
        type: "content.delta",
        scope: runScope,
        data: {
          partId: "r1",
          ...(index === 0 ? { kind: "reasoning" } : {}),
          delta: `**${heading}**\n`,
        },
      },
    });
    t += 120;
  }
  events.push(
    {
      atMs: t,
      raw: {
        type: "call.input",
        scope: runScope,
        data: {
          callId: "c_mail",
          kind: "tool",
          name: "read_file",
          delta: '{"filePath":"/mail/draft.md"',
        },
      },
    },
    {
      atMs: t + 80,
      raw: {
        type: "call.input",
        scope: runScope,
        data: { callId: "c_mail", delta: "}" },
      },
    },
    {
      atMs: t + 120,
      raw: {
        type: "call.requested",
        scope: runScope,
        data: {
          callId: "c_mail",
          capability: { kind: "tool", name: "read_file" },
          owner: { runId: RUN },
          input: { filePath: "/mail/draft.md" },
        },
      },
    },
    {
      atMs: t + 140,
      raw: {
        type: "call.started",
        scope: runScope,
        data: { callId: "c_mail" },
      },
    },
    {
      atMs: t + 220,
      raw: {
        type: "call.settled",
        scope: runScope,
        data: {
          callId: "c_mail",
          outcome: "completed",
          output: { text: "draft" },
        },
      },
    },
    {
      atMs: t + 400,
      raw: {
        type: "content.delta",
        scope: runScope,
        data: {
          partId: "t1",
          kind: "text",
          delta: "Ready with a calm reply.",
        },
      },
    },
    {
      atMs: t + 500,
      raw: {
        type: "turn.settled",
        scope: turnScope,
        data: { turnId: TURN, outcome: "completed" },
      },
    },
  );
  return stamp(events);
}

export const STREAM_PLAY_SCENARIOS: readonly StreamPlayScenario[] = [
  {
    id: "reasoning-tools",
    title: "Reasoning + Tools",
    description:
      "Reasoning headings, streaming tool args, progress, then a reply.",
    events: reasoningToolsScript(),
  },
  {
    id: "compaction-retry-subagent",
    title: "Compaction + Retry",
    description: "Context compaction, model retry, then a subagent task.",
    events: compactionRetrySubagentScript(),
  },
  {
    id: "rapid-burst",
    title: "Rapid Burst",
    description: "Fast heading/tool transitions to stress dwell coalescing.",
    events: rapidBurstScript(),
  },
];

export function streamPlayScenario(
  id: StreamPlayScenarioId,
): StreamPlayScenario {
  return (
    STREAM_PLAY_SCENARIOS.find((scenario) => scenario.id === id) ??
    STREAM_PLAY_SCENARIOS[0]!
  );
}

/** Project the first `count` timed events through eve's conversation fold. */
export function conversationAt(
  events: readonly TimedStreamEvent[],
  count: number,
  baseMs?: number,
): ConversationState {
  const slice = rebaseEvents(
    events.slice(0, Math.max(0, Math.min(count, events.length))),
    baseMs,
  );
  return conversationOf(slice);
}

/**
 * Re-stamp fixture `meta.at` relative to `baseMs` so TurnElapsedProvider
 * counts from 0s during interactive playback instead of showing age since
 * a static calendar date.
 */
export function rebaseEvents(
  events: readonly TimedStreamEvent[],
  baseMs?: number,
): SessionStreamEvent[] {
  if (baseMs === undefined) return events.map((entry) => entry.event);
  return events.map((entry) => {
    const raw = entry.event as unknown as Record<string, unknown> & {
      readonly meta?: Record<string, unknown>;
    };
    return {
      ...raw,
      meta: {
        ...raw.meta,
        at: new Date(baseMs + entry.atMs).toISOString(),
      },
    } as unknown as SessionStreamEvent;
  });
}

export function eventTypeAt(
  events: readonly TimedStreamEvent[],
  index: number,
): string {
  if (index < 0 || index >= events.length) return "—";
  return events[index]!.event.type;
}

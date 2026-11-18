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

import { THREAD_SAMPLES, type ThreadSampleId } from "./thread-samples";
import { eventsFromThreadSample } from "./sample-stream-replay";

export type StreamPlayScenarioId =
  | "reasoning-tools"
  | "compaction-retry-subagent"
  | "rapid-burst"
  | "todos"
  | "imagine"
  | "file-canvas"
  | ThreadSampleId;

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

function todosScript(): TimedStreamEvent[] {
  const initial = [
    {
      content: "Add stepEnter mounts",
      status: "in_progress",
      priority: "high",
    },
    {
      content: "Wire Planning next moves",
      status: "pending",
      priority: "high",
    },
    {
      content: "Add todo replay fixtures",
      status: "pending",
      priority: "medium",
    },
  ] as const;
  const mid = [
    { ...initial[0], status: "completed" },
    { ...initial[1], status: "in_progress" },
    initial[2],
  ] as const;
  const done = [
    { ...initial[0], status: "completed" },
    { ...initial[1], status: "completed" },
    { ...initial[2], status: "completed" },
  ] as const;

  return stamp([
    ...turnPrelude(),
    {
      atMs: 400,
      raw: {
        type: "call.input",
        scope: runScope,
        data: {
          callId: "c_todo_1",
          kind: "tool",
          name: "todo",
          delta: `{"todos":${JSON.stringify(initial).slice(0, -1)}`,
        },
      },
    },
    {
      atMs: 700,
      raw: {
        type: "call.input",
        scope: runScope,
        data: { callId: "c_todo_1", delta: "]}" },
      },
    },
    {
      atMs: 850,
      raw: {
        type: "call.requested",
        scope: runScope,
        data: {
          callId: "c_todo_1",
          capability: { kind: "tool", name: "todo" },
          owner: { runId: RUN },
          input: { todos: initial },
        },
      },
    },
    {
      atMs: 950,
      raw: {
        type: "call.started",
        scope: runScope,
        data: { callId: "c_todo_1" },
      },
    },
    {
      atMs: 1200,
      raw: {
        type: "call.settled",
        scope: runScope,
        data: {
          callId: "c_todo_1",
          outcome: "completed",
          output: { todos: initial },
        },
      },
    },
    {
      atMs: 2200,
      raw: {
        type: "call.requested",
        scope: runScope,
        data: {
          callId: "c_todo_2",
          capability: { kind: "tool", name: "todo" },
          owner: { runId: RUN },
          input: { todos: mid },
        },
      },
    },
    {
      atMs: 2300,
      raw: {
        type: "call.started",
        scope: runScope,
        data: { callId: "c_todo_2" },
      },
    },
    {
      atMs: 2600,
      raw: {
        type: "call.settled",
        scope: runScope,
        data: {
          callId: "c_todo_2",
          outcome: "completed",
          output: { todos: mid },
        },
      },
    },
    {
      atMs: 3600,
      raw: {
        type: "call.requested",
        scope: runScope,
        data: {
          callId: "c_todo_3",
          capability: { kind: "tool", name: "todo" },
          owner: { runId: RUN },
          input: { todos: done },
        },
      },
    },
    {
      atMs: 3700,
      raw: {
        type: "call.started",
        scope: runScope,
        data: { callId: "c_todo_3" },
      },
    },
    {
      atMs: 4000,
      raw: {
        type: "call.settled",
        scope: runScope,
        data: {
          callId: "c_todo_3",
          outcome: "completed",
          output: { todos: done },
        },
      },
    },
    {
      atMs: 4500,
      raw: {
        type: "content.delta",
        scope: runScope,
        data: {
          partId: "t1",
          kind: "text",
          delta:
            "Checklist is live — mounts enter with motion and rows check off as work settles.",
        },
      },
    },
    {
      atMs: 4900,
      raw: {
        type: "content.completed",
        scope: runScope,
        data: {
          partId: "t1",
          kind: "text",
          phase: "reply",
          runId: RUN,
          value:
            "Checklist is live — mounts enter with motion and rows check off as work settles.",
        },
      },
    },
    {
      atMs: 5100,
      raw: {
        type: "turn.settled",
        scope: turnScope,
        data: { turnId: TURN, outcome: "completed" },
      },
    },
  ]);
}

const IMAGINE_PROMPT =
  "Quiet coastal road at dusk, soft amber light, long shadows, photographic, 16:9";
const IMAGINE_IMAGE_URL =
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=1024&h=576&fit=crop";

function imagineScript(): TimedStreamEvent[] {
  return stamp([
    { atMs: 0, raw: { type: "session.started", data: {} } },
    {
      atMs: 20,
      raw: { type: "delivery.admitted", data: { deliveryId: "d_imagine" } },
    },
    {
      atMs: 40,
      raw: {
        type: "delivery.consumed",
        scope: turnScope,
        data: {
          deliveryId: "d_imagine",
          turnId: TURN,
          parts: [
            {
              kind: "text",
              text: "Make a photo of a quiet coastal road at dusk, 16:9.",
            },
          ],
        },
      },
    },
    {
      atMs: 60,
      raw: {
        type: "turn.started",
        scope: turnScope,
        data: {
          turnId: TURN,
          cause: { deliveryId: "d_imagine" },
          follows: null,
        },
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
    {
      atMs: 350,
      raw: {
        type: "content.delta",
        scope: runScope,
        data: {
          partId: "t_imagine_lead",
          kind: "text",
          delta: "Generating that now — ",
        },
      },
    },
    {
      atMs: 550,
      raw: {
        type: "content.delta",
        scope: runScope,
        data: {
          partId: "t_imagine_lead",
          delta: "coastal road at dusk, wide frame.",
        },
      },
    },
    {
      atMs: 700,
      raw: {
        type: "content.completed",
        scope: runScope,
        data: {
          partId: "t_imagine_lead",
          kind: "text",
          phase: "reply",
          runId: RUN,
          value: "Generating that now — coastal road at dusk, wide frame.",
        },
      },
    },
    {
      atMs: 900,
      raw: {
        type: "call.input",
        scope: runScope,
        data: {
          callId: "c_imagine",
          kind: "tool",
          name: "generate_image",
          delta: '{"prompt":"Quiet coastal road at dusk, soft amber',
        },
      },
    },
    {
      atMs: 1100,
      raw: {
        type: "call.input",
        scope: runScope,
        data: {
          callId: "c_imagine",
          delta:
            ' light, long shadows, photographic","aspectRatio":"16:9"}',
        },
      },
    },
    {
      atMs: 1250,
      raw: {
        type: "call.requested",
        scope: runScope,
        data: {
          callId: "c_imagine",
          capability: {
            kind: "tool",
            name: "generate_image",
            label: `Generating image · ${IMAGINE_PROMPT.slice(0, 39)}…`,
          },
          owner: { runId: RUN },
          input: {
            prompt: IMAGINE_PROMPT,
            aspectRatio: "16:9",
          },
        },
      },
    },
    {
      atMs: 1350,
      raw: {
        type: "call.started",
        scope: runScope,
        data: { callId: "c_imagine" },
      },
    },
    {
      atMs: 1600,
      raw: {
        type: "call.progress",
        scope: runScope,
        data: {
          callId: "c_imagine",
          label: "Generating image…",
          output: { status: "running" },
        },
      },
    },
    // Deliberate dwell so the aspect-ratio placeholder is inspectable in replay.
    {
      atMs: 4800,
      raw: {
        type: "call.settled",
        scope: runScope,
        data: {
          callId: "c_imagine",
          outcome: "completed",
          label: "Generated image",
          output: {
            success: true,
            url: IMAGINE_IMAGE_URL,
            downloadUrl: IMAGINE_IMAGE_URL,
            pathname: "design/generated/coastal-road.png",
            contentType: "image/jpeg",
            model: "spacexai/grok-imagine-image-2.0",
            prompt: IMAGINE_PROMPT,
          },
        },
      },
    },
    {
      atMs: 5200,
      raw: {
        type: "content.delta",
        scope: runScope,
        data: {
          partId: "t_imagine_done",
          kind: "text",
          delta: "Here's the dusk coastal road — ",
        },
      },
    },
    {
      atMs: 5450,
      raw: {
        type: "content.delta",
        scope: runScope,
        data: {
          partId: "t_imagine_done",
          delta: "16:9, soft amber light.",
        },
      },
    },
    {
      atMs: 5600,
      raw: {
        type: "content.completed",
        scope: runScope,
        data: {
          partId: "t_imagine_done",
          kind: "text",
          phase: "reply",
          runId: RUN,
          value: "Here's the dusk coastal road — 16:9, soft amber light.",
        },
      },
    },
    {
      atMs: 5800,
      raw: {
        type: "turn.settled",
        scope: turnScope,
        data: { turnId: TURN, outcome: "completed" },
      },
    },
  ]);
}

const FILE_CANVAS_MD = [
  "# Mobile canvas\n\n",
  "Full-screen editable text while Pearl writes.\n\n",
  "- Auto-opens on `write_file`\n",
  "- Floating Ask Pearl composer\n",
  "- Undo, redo, and copy\n",
].join("");

function fileCanvasScript(): TimedStreamEvent[] {
  const argsStart = '{"filePath":"docs/mobile-canvas.md","content":"';
  const chunkA = "# Mobile canvas\\n\\nFull-screen editable text while Pearl writes.\\n\\n";
  const chunkB =
    "- Auto-opens on `write_file`\\n- Floating Ask Pearl composer\\n- Undo, redo, and copy\\n";
  const argsEnd = '"}';
  return stamp([
    { atMs: 0, raw: { type: "session.started", data: {} } },
    {
      atMs: 20,
      raw: { type: "delivery.admitted", data: { deliveryId: "d_file" } },
    },
    {
      atMs: 40,
      raw: {
        type: "delivery.consumed",
        scope: turnScope,
        data: {
          deliveryId: "d_file",
          turnId: TURN,
          parts: [
            {
              kind: "text",
              text: "Write a short README for the mobile canvas.",
            },
          ],
        },
      },
    },
    {
      atMs: 60,
      raw: {
        type: "turn.started",
        scope: turnScope,
        data: {
          turnId: TURN,
          cause: { deliveryId: "d_file" },
          follows: null,
        },
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
    {
      atMs: 300,
      raw: {
        type: "content.delta",
        scope: runScope,
        data: {
          partId: "t_file_lead",
          kind: "text",
          delta: "I'll draft `docs/mobile-canvas.md` now.",
        },
      },
    },
    {
      atMs: 500,
      raw: {
        type: "content.completed",
        scope: runScope,
        data: {
          partId: "t_file_lead",
          kind: "text",
          phase: "reply",
          runId: RUN,
          value: "I'll draft `docs/mobile-canvas.md` now.",
        },
      },
    },
    {
      atMs: 700,
      raw: {
        type: "call.input",
        scope: runScope,
        data: {
          callId: "c_write",
          kind: "tool",
          name: "write_file",
          delta: argsStart + chunkA,
        },
      },
    },
    {
      atMs: 1600,
      raw: {
        type: "call.input",
        scope: runScope,
        data: {
          callId: "c_write",
          delta: chunkB,
        },
      },
    },
    {
      atMs: 2200,
      raw: {
        type: "call.input",
        scope: runScope,
        data: {
          callId: "c_write",
          delta: argsEnd,
        },
      },
    },
    {
      atMs: 2400,
      raw: {
        type: "call.requested",
        scope: runScope,
        data: {
          callId: "c_write",
          capability: {
            kind: "tool",
            name: "write_file",
            label: "Writing docs/mobile-canvas.md",
          },
          owner: { runId: RUN },
          input: {
            filePath: "docs/mobile-canvas.md",
            content: FILE_CANVAS_MD,
          },
        },
      },
    },
    {
      atMs: 2500,
      raw: {
        type: "call.started",
        scope: runScope,
        data: { callId: "c_write" },
      },
    },
    {
      atMs: 5200,
      raw: {
        type: "call.settled",
        scope: runScope,
        data: {
          callId: "c_write",
          outcome: "completed",
          label: "Wrote docs/mobile-canvas.md",
          output: {
            path: "docs/mobile-canvas.md",
            existed: false,
            persisted: true,
          },
        },
      },
    },
    {
      atMs: 5600,
      raw: {
        type: "content.delta",
        scope: runScope,
        data: {
          partId: "t_file_done",
          kind: "text",
          delta: "Saved the README — open it in the canvas to edit.",
        },
      },
    },
    {
      atMs: 5800,
      raw: {
        type: "content.completed",
        scope: runScope,
        data: {
          partId: "t_file_done",
          kind: "text",
          phase: "reply",
          runId: RUN,
          value: "Saved the README — open it in the canvas to edit.",
        },
      },
    },
    {
      atMs: 6000,
      raw: {
        type: "turn.settled",
        scope: turnScope,
        data: { turnId: TURN, outcome: "completed" },
      },
    },
  ]);
}

const CORE_STREAM_PLAY_SCENARIOS: readonly StreamPlayScenario[] = [
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
    description:
      "Fast heading/tool transitions to stress 2000ms dwell coalescing.",
    events: rapidBurstScript(),
  },
  {
    id: "todos",
    title: "Todos",
    description:
      "Streaming todo list mounts early, then rows check off with progress.",
    events: todosScript(),
  },
  {
    id: "imagine",
    title: "Imagine",
    description:
      "generate_image args stream, running placeholder, then settled preview.",
    events: imagineScript(),
  },
  {
    id: "file-canvas",
    title: "File canvas",
    description:
      "write_file args stream into the editable mobile canvas, then settle.",
    events: fileCanvasScript(),
  },
];

const CORE_STREAM_IDS = new Set(
  CORE_STREAM_PLAY_SCENARIOS.map((scenario) => scenario.id),
);

/** Every static thread sample, synthesized into a paced stream script. */
const SAMPLE_STREAM_PLAY_SCENARIOS: readonly StreamPlayScenario[] =
  THREAD_SAMPLES.filter((sample) => !CORE_STREAM_IDS.has(sample.id)).map(
    (sample) => ({
      id: sample.id,
      title: sample.label,
      description: `Stream replay synthesized from the “${sample.label}” sample.`,
      events: eventsFromThreadSample(sample),
    }),
  );

export const STREAM_PLAY_SCENARIOS: readonly StreamPlayScenario[] = [
  ...CORE_STREAM_PLAY_SCENARIOS,
  ...SAMPLE_STREAM_PLAY_SCENARIOS,
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

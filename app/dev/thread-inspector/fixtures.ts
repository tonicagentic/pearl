import type { ThreadMessageLike } from "@assistant-ui/react";
import {
  conversationOf,
  type ConversationState,
  type SessionStreamEvent,
} from "eve/client";

export type WebReplayScenarioId =
  | "reasoning-tools"
  | "rapid-burst"
  | "approval-park";

export type TimedWebStreamEvent = {
  readonly atMs: number;
  readonly event: SessionStreamEvent;
};

export type WebReplayScenario = {
  readonly id: WebReplayScenarioId;
  readonly title: string;
  readonly description: string;
  readonly events: readonly TimedWebStreamEvent[];
};

type RawEvent = {
  readonly type: string;
  readonly scope?: Record<string, string>;
  readonly data: Record<string, unknown>;
};

const TURN = "turn_inspect";
const RUN = "run_inspect";
const turnScope = { turnId: TURN };
const runScope = { runId: RUN, turnId: TURN };

function stamp(
  events: readonly { readonly atMs: number; readonly raw: RawEvent }[],
): TimedWebStreamEvent[] {
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

function prelude(prompt: string): { atMs: number; raw: RawEvent }[] {
  return [
    { atMs: 0, raw: { type: "session.started", data: {} } },
    { atMs: 20, raw: { type: "delivery.admitted", data: { deliveryId: "d1" } } },
    {
      atMs: 40,
      raw: {
        type: "delivery.consumed",
        scope: turnScope,
        data: {
          deliveryId: "d1",
          turnId: TURN,
          parts: [{ kind: "text", text: prompt }],
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

export const WEB_REPLAY_SCENARIOS: readonly WebReplayScenario[] = [
  {
    id: "reasoning-tools",
    title: "Reasoning + Tools",
    description:
      "Multi-heading reasoning, streaming argsText tool chip, settled timeline, and reply.",
    events: stamp([
      ...prelude("Tighten the spacing and typography of the message thread."),
      {
        atMs: 500,
        raw: {
          type: "content.delta",
          scope: runScope,
          data: {
            partId: "r1",
            kind: "reasoning",
            delta:
              "**Inspect thread layout**\nChecking message padding, line height, and timeline hierarchy.\n",
          },
        },
      },
      {
        atMs: 1300,
        raw: {
          type: "content.delta",
          scope: runScope,
          data: {
            partId: "r1",
            delta:
              "\n**Verify shimmer direction**\nConfirming left-to-right gradient sweep on thinking-states.\n",
          },
        },
      },
      {
        atMs: 2100,
        raw: {
          type: "call.input",
          scope: runScope,
          data: {
            callId: "c_read",
            kind: "tool",
            name: "read_file",
            delta: '{"filePath":"components/assistant-ui/elements/thread.aui',
          },
        },
      },
      {
        atMs: 2500,
        raw: {
          type: "call.input",
          scope: runScope,
          data: { callId: "c_read", delta: '.tsx","offset":780,"limit":40}' },
        },
      },
      {
        atMs: 2650,
        raw: {
          type: "content.completed",
          scope: runScope,
          data: {
            partId: "r1",
            kind: "reasoning",
            phase: "reasoning",
            runId: RUN,
            value:
              "**Inspect thread layout**\nChecking message padding, line height, and timeline hierarchy.\n\n**Verify shimmer direction**\nConfirming left-to-right gradient sweep on thinking-states.\n",
          },
        },
      },
      {
        atMs: 2700,
        raw: {
          type: "call.requested",
          scope: runScope,
          data: {
            callId: "c_read",
            capability: { kind: "tool", name: "read_file" },
            owner: { runId: RUN },
            input: {
              filePath: "components/assistant-ui/elements/thread.aui.tsx",
              offset: 780,
              limit: 40,
            },
          },
        },
      },
      {
        atMs: 2800,
        raw: {
          type: "call.started",
          scope: runScope,
          data: { callId: "c_read" },
        },
      },
      {
        atMs: 3600,
        raw: {
          type: "call.settled",
          scope: runScope,
          data: {
            callId: "c_read",
            outcome: "completed",
            output: { content: "// AssistantMessage" },
          },
        },
      },
      {
        atMs: 4100,
        raw: {
          type: "content.delta",
          scope: runScope,
          data: {
            partId: "t1",
            kind: "text",
            delta:
              "Everything in `AssistantMessage` shares the `15px / 24px` (`leading-6`) type scale, with `gap-3` between blocks and `px-2` horizontal alignment.",
          },
        },
      },
      {
        atMs: 4500,
        raw: {
          type: "content.completed",
          scope: runScope,
          data: {
            partId: "t1",
            kind: "text",
            phase: "reply",
            runId: RUN,
            value:
              "Everything in `AssistantMessage` shares the `15px / 24px` (`leading-6`) type scale, with `gap-3` between blocks and `px-2` horizontal alignment.",
          },
        },
      },
      {
        atMs: 4700,
        raw: {
          type: "turn.settled",
          scope: turnScope,
          data: { turnId: TURN, outcome: "completed" },
        },
      },
    ]),
  },
  {
    id: "rapid-burst",
    title: "Rapid Burst",
    description:
      "Fast reasoning headings to inspect 2000ms dwell coalescing and 150ms + 50ms swaps.",
    events: (() => {
      const headings = [
        "Scan tokens",
        "Check vertical rhythm",
        "Compare mobile scale",
        "Check diff badges",
        "Verify width transition",
      ];
      const list = prelude("Stress-test the thinking-states animation.");
      let t = 250;
      for (const [i, heading] of headings.entries()) {
        list.push({
          atMs: t,
          raw: {
            type: "content.delta",
            scope: runScope,
            data: {
              partId: "r1",
              ...(i === 0 ? { kind: "reasoning" } : {}),
              delta: `**${heading}**\n`,
            },
          },
        });
        t += 150;
      }
      list.push(
        {
          atMs: t + 900,
          raw: {
            type: "content.delta",
            scope: runScope,
            data: {
              partId: "t1",
              kind: "text",
              delta: "Dwell coalescing kept the status transitions calm.",
            },
          },
        },
        {
          atMs: t + 1200,
          raw: {
            type: "turn.settled",
            scope: turnScope,
            data: { turnId: TURN, outcome: "completed" },
          },
        },
      );
      return stamp(list);
    })(),
  },
  {
    id: "approval-park",
    title: "Approval Park",
    description:
      "Inspect the WaitingActionDock and inline ToolFallback approval states.",
    events: stamp([
      ...prelude("Send the updated summary email to Alex."),
      {
        atMs: 350,
        raw: {
          type: "call.requested",
          scope: runScope,
          data: {
            callId: "c_mail",
            capability: { kind: "tool", name: "gmail_send" },
            owner: { runId: RUN },
            input: {
              to: "alex@tingiris.com",
              subject: "Thread UI polish notes",
              body: "Ready for a final visual pass.",
            },
          },
        },
      },
      {
        atMs: 500,
        raw: {
          type: "interaction.opened",
          scope: turnScope,
          data: {
            interactionId: "int_mail",
            subject: { callId: "c_mail" },
            audience: { principalIds: ["u1"] },
            request: {
              kind: "approval",
              display: "decision",
              prompt: "Send email to alex@tingiris.com?",
              options: [
                { id: "approve", label: "Approve", kind: "accept" },
                { id: "deny", label: "Cancel", kind: "decline" },
              ],
            },
          },
        },
      },
      {
        atMs: 700,
        raw: {
          type: "turn.paused",
          scope: turnScope,
          data: {
            turnId: TURN,
            awaiting: [{ interactionId: "int_mail" }],
          },
        },
      },
    ]),
  },
];

export function webReplayScenario(id: WebReplayScenarioId): WebReplayScenario {
  return (
    WEB_REPLAY_SCENARIOS.find((s) => s.id === id) ?? WEB_REPLAY_SCENARIOS[0]!
  );
}

export function rebaseEvents(
  events: readonly TimedWebStreamEvent[],
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

export function conversationAt(
  events: readonly TimedWebStreamEvent[],
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
 * Static full-coverage gallery exercising every message thread UI component
 * simultaneously for CSS / spacing / typography inspection.
 */
export const GALLERY_MESSAGES: readonly ThreadMessageLike[] = [
  {
    id: "gal_user_1",
    role: "user",
    createdAt: new Date("2026-11-16T16:10:00.000Z"),
    content: [
      {
        type: "text",
        text: "Review the message thread spacing, timeline steps, inline code blocks, and live thinking state.",
      },
    ],
  },
  {
    id: "gal_asst_settled",
    role: "assistant",
    createdAt: new Date("2026-11-16T16:10:12.000Z"),
    status: { type: "complete", reason: "stop" },
    metadata: { custom: { turnId: "gal_turn_1" } },
    content: [
      {
        type: "reasoning",
        text: "Comparing web threadMeta (`15px / 24px`) against the mobile thread metrics.\n\n1. User bubble: `rounded-[20px] bg-(--user-bubble-bg) px-4 py-2.5`\n2. Assistant column: `px-2 text-[15px] leading-6 gap-3`\n3. Timeline trigger + rows: `min-h-6 py-0.5 gap-1.5`",
      },
      {
        type: "tool-call",
        toolCallId: "gal_skill",
        toolName: "load_skill",
        args: { skill: "web-design-guidelines" },
        result: { loaded: true },
      },
      {
        type: "tool-call",
        toolCallId: "gal_read",
        toolName: "read_file",
        args: {
          filePath: "components/assistant-ui/elements/thread.aui.tsx",
          offset: 775,
          limit: 45,
        },
        result: { lines: 45 },
      },
      {
        type: "tool-call",
        toolCallId: "gal_search",
        toolName: "grep",
        args: { pattern: "threadMeta|threadText" },
        result: { matches: 14 },
      },
      {
        type: "tool-call",
        toolCallId: "gal_bash",
        toolName: "bash",
        args: { command: "pnpm typecheck" },
        result: { exitCode: 0 },
      },
      {
        type: "tool-call",
        toolCallId: "gal_edit",
        toolName: "edit_file",
        args: {
          filePath: "components/assistant-ui/elements/assistant-thinking.tsx",
          oldText: "const a = 1;\nconst b = 2;",
          newText:
            "const a = 1;\nconst b = 2;\nconst c = 3;\nconst d = 4;\nconst e = 5;",
        },
        result: { ok: true },
      },
      {
        type: "text",
        text: [
          "### Thread Anatomy Check",
          "",
          "All timeline steps, prose paragraphs, lists, and code blocks share the same **`15px` (`leading-6`)** baseline:",
          "",
          "- **User bubble**: `max-w-[78%] rounded-[20px] px-4 py-2.5`",
          "- **Session timeline**: collapsed summary with `+5 −2` diff counters and expandable reasoning",
          "- **Thinking states**: `150ms` exit/enter with `50ms` gap and `2000ms` LTR shimmer",
          "",
          "```tsx",
          "export function ThinkingIndicator({ label, elapsed }: Props) {",
          "  return <ThinkingStatesLabel label={label} />;",
          "}",
          "```",
          "",
          "| Token | Value | Role |",
          "| --- | --- | --- |",
          "| `--think-hold` | `2000ms` | Min visible label before next swap |",
          "| `--think-swap` | `150ms` | Blur + slide swap |",
          "| `--think-gap` | `50ms` | Outgoing lead gap |",
          "| `--shimmer-dur` | `2000ms` | LTR highlight sweep |",
          "",
          "> Tip: toggle dark mode or switch column width above while inspecting elements in DevTools.",
        ].join("\n"),
      },
    ],
  },
  {
    id: "gal_user_2",
    role: "user",
    createdAt: new Date("2026-11-16T16:11:00.000Z"),
    content: [
      {
        type: "text",
        text: "Show a live streaming thinking state with a delegated task card too.",
      },
    ],
  },
  {
    id: "gal_asst_live",
    role: "assistant",
    createdAt: new Date("2026-11-16T16:11:02.000Z"),
    status: { type: "running" },
    content: [
      {
        type: "reasoning",
        text: "**Refining bubble spacing**\nChecking alignment between the thinking status line and the user bubble edge.",
      },
      {
        type: "tool-call",
        toolCallId: "gal_task",
        toolName: "coder",
        args: { task: "Polish thread visual hierarchy" },
      },
      {
        type: "tool-call",
        toolCallId: "gal_read_live",
        toolName: "read_file",
        args: {},
        argsText: '{"filePath":"components/assistant-ui/elements/surfaces.tsx',
      },
    ],
  },
];

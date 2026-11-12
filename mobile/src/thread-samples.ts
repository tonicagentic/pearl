import type { ThreadMessageLike } from "@assistant-ui/react-native";
import type { ReadonlyJSONObject } from "assistant-stream/utils";

export type ThreadSampleId = "one-read" | "mixed" | "actions";

export type ThreadSample = {
  readonly id: ThreadSampleId;
  readonly label: string;
  readonly messages: readonly ThreadMessageLike[];
  /** Fixture events for Worked-for duration; never written to the chat store. */
  readonly durationEvents: readonly unknown[];
};

const MIXED_TURN_ID = "sample-mixed";
const MIXED_START = "2026-01-01T00:00:00.000Z";
const MIXED_END = "2026-01-01T00:00:18.000Z";

const mixedDurationEvents = [
  {
    type: "message.appended",
    data: { turnId: MIXED_TURN_ID },
    meta: { at: MIXED_START },
  },
  {
    type: "session.completed",
    data: { turnId: MIXED_TURN_ID },
    meta: { at: MIXED_END },
  },
] as const;

type SampleToolPart = Extract<
  Exclude<ThreadMessageLike["content"], string>[number],
  { type: "tool-call" }
>;

function toolCall(
  toolName: string,
  args: ReadonlyJSONObject,
  extras: Partial<SampleToolPart> = {},
): SampleToolPart {
  return {
    type: "tool-call",
    toolCallId: `sample-${toolName}-${Object.keys(args).join("-") || "x"}`,
    toolName,
    args,
    argsText: JSON.stringify(args, null, 2),
    result: "ok",
    ...extras,
  };
}

const TODOS = [
  {
    content: "Update timeline defaults",
    status: "completed" as const,
    priority: "high" as const,
  },
  {
    content: "Write the patch notes",
    status: "completed" as const,
    priority: "medium" as const,
  },
  {
    content: "Confirm deploy",
    status: "in_progress" as const,
    priority: "high" as const,
  },
];

const mixedContent = [
  {
    type: "reasoning" as const,
    text: "Gather the timeline behavior, the React docs page, and open a tracking issue.",
  },
  toolCall("read_file", { filePath: "session-timeline.tsx" }),
  toolCall("web_fetch", {
    url: "https://react.dev/reference/rsc",
  }),
  toolCall("web_search", { query: "react cache" }),
  toolCall("bash", { command: "pnpm test" }),
  toolCall("create_issue", {
    title: "Timeline should default every tool",
    message: "Timeline should default every tool",
  }),
  {
    type: "text" as const,
    text: "I checked the timeline, opened the React docs, ran the tests, and filed an issue.",
  },
];

const oneRead: ThreadSample = {
  id: "one-read",
  label: "One read",
  durationEvents: [],
  messages: [
    {
      role: "user",
      content: [{ type: "text", text: "What's in notes.md?" }],
    },
    {
      role: "assistant",
      status: { type: "complete", reason: "stop" },
      content: [
        toolCall("read_file", { filePath: "notes.md" }),
        {
          type: "text",
          text: "notes.md is a short scratch pad with today's priorities.",
        },
      ],
      metadata: { custom: { turnId: "sample-one-read" } },
    },
  ],
};

const mixed: ThreadSample = {
  id: "mixed",
  label: "Mixed turn",
  durationEvents: mixedDurationEvents,
  messages: [
    {
      role: "user",
      content: [
        {
          type: "text",
          text: "Review the timeline, check the docs, and open an issue.",
        },
      ],
    },
    {
      role: "assistant",
      status: { type: "complete", reason: "stop" },
      content: mixedContent,
      metadata: { custom: { turnId: MIXED_TURN_ID } },
    },
  ],
};

const actions: ThreadSample = {
  id: "actions",
  label: "Actions",
  durationEvents: mixedDurationEvents,
  messages: [
    {
      role: "user",
      content: [
        { type: "text", text: "Ship the timeline default and patch notes." },
      ],
    },
    {
      role: "assistant",
      status: { type: "requires-action", reason: "tool-calls" },
      content: [
        {
          type: "reasoning" as const,
          text: "Read the current notes, write a patch, and ask before deploying.",
        },
        toolCall("read_file", { filePath: "notes.md" }),
        toolCall(
          "todo",
          { todos: TODOS },
          { result: { todos: TODOS } },
        ),
        toolCall("write_file", {
          filePath: "notes.md",
          content:
            "# Notes\n\n- Timeline is the default tool row\n- Worked for stays for multi-step turns\n",
        }),
        toolCall(
          "coder",
          { message: "Wire isTimelineToolCall through the thread renderer" },
          { toolCallId: "sample-coder-1" },
        ),
        // No result + unresolved approval → part status inherits requires-action.
        {
          type: "tool-call",
          toolCallId: "sample-confirm-1",
          toolName: "confirm_step",
          args: { summary: "Deploy the timeline default to preview" },
          argsText:
            '{\n  "summary": "Deploy the timeline default to preview"\n}',
          approval: {
            id: "sample-confirm-1",
            prompt: "Deploy the timeline default to preview?",
            display: "decision",
          },
        },
        {
          type: "text",
          text: "Ready when you are — approve the deploy step to continue.",
        },
      ],
      metadata: { custom: { turnId: MIXED_TURN_ID } },
    },
  ],
};

export const THREAD_SAMPLES: readonly ThreadSample[] = [
  oneRead,
  mixed,
  actions,
];

export function threadSample(id: ThreadSampleId): ThreadSample {
  return THREAD_SAMPLES.find((sample) => sample.id === id) ?? oneRead;
}

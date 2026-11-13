import type { WaitingAction } from "@/components/assistant-ui/elements/waiting-action-card";
import type { ThreadMessageLike } from "@assistant-ui/react-native";
import type { ReadonlyJSONObject } from "assistant-stream/utils";

export type ThreadSampleId =
  | "approve"
  | "choose"
  | "ask"
  | "questions"
  | "authorize"
  | "gallery"
  | "one-read"
  | "mixed";

type SampleWaitingAction = Exclude<
  WaitingAction,
  { readonly kind: "questions" }
> | {
  readonly kind: "questions";
  readonly items: NonNullable<
    Extract<WaitingAction, { kind: "questions" }>["items"]
  >;
};

export type ThreadSample = {
  readonly id: ThreadSampleId;
  readonly label: string;
  readonly messages: readonly ThreadMessageLike[];
  /** Fixture events for Worked-for duration; never written to the chat store. */
  readonly durationEvents: readonly unknown[];
  /** Optional HITL surface that morphs the composer (authorization / approval / questions). */
  readonly waitingAction?: SampleWaitingAction;
};

type SampleToolPart = Extract<
  Exclude<ThreadMessageLike["content"], string>[number],
  { type: "tool-call" }
>;

type ApprovalOption = NonNullable<
  NonNullable<SampleToolPart["approval"]>["options"]
>[number];

const APPROVE_TURN_ID = "sample-approve";
const CHOOSE_TURN_ID = "sample-choose";
const ASK_TURN_ID = "sample-ask";
const QUESTIONS_TURN_ID = "sample-questions";
const GALLERY_TURN_ID = "sample-gallery";
const MIXED_TURN_ID = "sample-mixed";
const MIXED_START = "2026-01-01T00:00:00.000Z";
const MIXED_END = "2026-01-01T00:00:18.000Z";
const GALLERY_END = "2026-01-01T00:00:42.000Z";
const SHORT_END = "2026-01-01T00:00:08.000Z";

function durationEvents(turnId: string, endAt: string) {
  return [
    {
      type: "message.appended",
      data: { turnId },
      meta: { at: MIXED_START },
    },
    {
      type: "session.completed",
      data: { turnId },
      meta: { at: endAt },
    },
  ] as const;
}

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

/** Parked decision: interrupt tool part + composer HITL surface. */
function approvalPart({
  id,
  prompt,
  summary,
}: {
  readonly id: string;
  readonly prompt: string;
  readonly summary: string;
}): SampleToolPart {
  return {
    type: "tool-call",
    toolCallId: id,
    toolName: "confirm_step",
    args: { summary },
    argsText: JSON.stringify({ summary }, null, 2),
    approval: {
      id,
      prompt,
      display: "decision",
    },
  };
}

/** Parked question: select chips and/or free-text. */
function questionPart({
  id,
  prompt,
  options,
  allowFreeform = false,
}: {
  readonly id: string;
  readonly prompt: string;
  readonly options?: readonly { readonly id: string; readonly label: string }[];
  readonly allowFreeform?: boolean;
}): SampleToolPart {
  const hasOptions = Boolean(options?.length);
  const approvalOptions = options?.map(
    (option): ApprovalOption => ({
      id: option.id,
      kind: `_${option.id}`,
      label: option.label,
    }),
  );
  return {
    type: "tool-call",
    toolCallId: id,
    toolName: "ask_question",
    args: {
      prompt,
      ...(hasOptions ? { options } : {}),
    },
    argsText: JSON.stringify(
      { prompt, ...(hasOptions ? { options } : {}) },
      null,
      2,
    ),
    approval: {
      id,
      prompt,
      display: hasOptions ? "select" : "text",
      allowFreeform: allowFreeform || !hasOptions,
      ...(approvalOptions ? { options: approvalOptions } : {}),
    },
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

/** Tools → text → tools → text so the session timeline splits around prose. */
const mixedContent = [
  {
    type: "reasoning" as const,
    text: "Gather the timeline behavior and the React docs page.",
  },
  toolCall("read_file", { filePath: "session-timeline.tsx" }),
  toolCall("web_fetch", {
    url: "https://react.dev/reference/rsc",
  }),
  {
    type: "text" as const,
    text: "First pass: the timeline covers tools, and mid-turn prose should sit between tool clusters.",
  },
  {
    type: "reasoning" as const,
    text: "Run tests and file a tracking issue before wrapping up.",
  },
  toolCall("bash", { command: "pnpm test" }),
  toolCall("create_issue", {
    title: "Timeline should default every tool",
    message: "Timeline should default every tool",
  }),
  {
    type: "text" as const,
    text: "Tests are green and the issue is filed — live work stays under the latest tool cluster.",
  },
];

const approveConfirm = approvalPart({
  id: "sample-approve-1",
  prompt: "Deploy the timeline default to preview?",
  summary: "Deploy the timeline default to preview",
});

const chooseQuestion = questionPart({
  id: "sample-choose-1",
  prompt: "Which surface should we ship first?",
  allowFreeform: true,
  options: [
    { id: "mobile", label: "Mobile" },
    { id: "web", label: "Web" },
    { id: "both", label: "Both" },
  ],
});

const askQuestion = questionPart({
  id: "sample-ask-1",
  prompt: "Anything else before I open the PR?",
  allowFreeform: true,
});

/** Focused Allow / Deny — short timeline then one confirm. */
const approve: ThreadSample = {
  id: "approve",
  label: "Approve",
  durationEvents: durationEvents(APPROVE_TURN_ID, SHORT_END),
  waitingAction: {
    kind: "approval",
    title: "The agent is paused until you respond.",
    prompt: "Deploy the timeline default to preview?",
    options: [
      { id: "approve", label: "Allow" },
      { id: "cancel", label: "Deny" },
    ],
  },
  messages: [
    {
      role: "user",
      content: [{ type: "text", text: "Ship the timeline default when you're ready." }],
    },
    {
      role: "assistant",
      status: { type: "requires-action", reason: "tool-calls" },
      content: [
        {
          type: "reasoning",
          text: "Patch is ready. Confirm before deploying to preview.",
        },
        toolCall("read_file", { filePath: "notes.md" }),
        toolCall("bash", { command: "pnpm test" }),
        approveConfirm,
        {
          type: "text",
          text: "Ready when you are — approve to deploy preview.",
        },
      ],
      metadata: { custom: { turnId: APPROVE_TURN_ID } },
    },
  ],
};

/** Select questionnaire with optional freeform. */
const choose: ThreadSample = {
  id: "choose",
  label: "Choose",
  durationEvents: durationEvents(CHOOSE_TURN_ID, SHORT_END),
  waitingAction: {
    kind: "questions",
    items: [
      {
        id: "sample-choose-1",
        prompt: "Which surface should we ship first?",
        allowFreeform: true,
        options: [
          { id: "mobile", label: "Mobile" },
          { id: "web", label: "Web" },
          { id: "both", label: "Both" },
        ],
      },
    ],
  },
  messages: [
    {
      role: "user",
      content: [{ type: "text", text: "Where should we land the timeline change first?" }],
    },
    {
      role: "assistant",
      status: { type: "requires-action", reason: "tool-calls" },
      content: [
        {
          type: "reasoning",
          text: "Mobile and web share the same timeline model; pick a surface to ship first.",
        },
        toolCall("read_file", { filePath: "session-timeline.tsx" }),
        chooseQuestion,
      ],
      metadata: { custom: { turnId: CHOOSE_TURN_ID } },
    },
  ],
};

/** Free-text question only — prompt in-thread; answer via the normal composer. */
const ask: ThreadSample = {
  id: "ask",
  label: "Ask",
  durationEvents: durationEvents(ASK_TURN_ID, SHORT_END),
  messages: [
    {
      role: "user",
      content: [{ type: "text", text: "Open a PR for the timeline default." }],
    },
    {
      role: "assistant",
      status: { type: "requires-action", reason: "tool-calls" },
      content: [
        {
          type: "reasoning",
          text: "Branch is ready. Check for any last notes before opening the PR.",
        },
        toolCall("bash", { command: "git status -sb" }),
        askQuestion,
      ],
      metadata: { custom: { turnId: ASK_TURN_ID } },
    },
  ],
};

const storeQuestion = questionPart({
  id: "sample-questions-1",
  prompt: "Which store should the sessions live in?",
  options: [
    { id: "postgres", label: "Postgres — alongside the app" },
    { id: "redis", label: "Redis — expiring keys" },
    { id: "sqlite", label: "SQLite — one file on the box" },
  ],
});

const surfaceQuestion = questionPart({
  id: "sample-questions-2",
  prompt: "Which surface should we ship first?",
  options: [
    { id: "mobile", label: "Mobile" },
    { id: "web", label: "Web" },
    { id: "both", label: "Both" },
  ],
});

const notesQuestion = questionPart({
  id: "sample-questions-3",
  prompt: "Anything else before I open the PR?",
  allowFreeform: true,
});

/** Three open questions in one composer pager. */
const questions: ThreadSample = {
  id: "questions",
  label: "Questions",
  durationEvents: durationEvents(QUESTIONS_TURN_ID, SHORT_END),
  waitingAction: {
    kind: "questions",
    items: [
      {
        id: "sample-questions-1",
        prompt: "Which store should the sessions live in?",
        detail: "Every request reads the session, so this is the hot path.",
        allowFreeform: false,
        options: [
          { id: "postgres", label: "Postgres — alongside the app" },
          { id: "redis", label: "Redis — expiring keys" },
          { id: "sqlite", label: "SQLite — one file on the box" },
          { id: "cookies", label: "Signed cookies — no store at all" },
          { id: "other", label: "Something else…" },
        ],
      },
      {
        id: "sample-questions-2",
        prompt: "Which surface should we ship first?",
        allowFreeform: false,
        options: [
          { id: "mobile", label: "Mobile" },
          { id: "web", label: "Web" },
          { id: "both", label: "Both" },
        ],
      },
      {
        id: "sample-questions-3",
        prompt: "Anything else before I open the PR?",
        allowFreeform: true,
        options: [],
      },
    ],
  },
  messages: [
    {
      role: "user",
      content: [
        {
          type: "text",
          text: "Decide the session store, pick a surface, then open the PR.",
        },
      ],
    },
    {
      role: "assistant",
      status: { type: "requires-action", reason: "tool-calls" },
      content: [
        {
          type: "reasoning",
          text: "Three clarifying questions before wiring the store and opening the PR.",
        },
        storeQuestion,
        surfaceQuestion,
        notesQuestion,
      ],
      metadata: { custom: { turnId: QUESTIONS_TURN_ID } },
    },
  ],
};

/** Composer authorization banner (no in-thread tool park). */
const authorize: ThreadSample = {
  id: "authorize",
  label: "Authorize",
  durationEvents: [],
  waitingAction: {
    kind: "authorization",
    title: "Connect GitHub to continue.",
    detail:
      "Pearl needs access to open the pull request. Sign in, then return here.",
  },
  messages: [
    {
      role: "user",
      content: [{ type: "text", text: "Open the PR on GitHub." }],
    },
    {
      role: "assistant",
      status: { type: "requires-action", reason: "interrupt" },
      content: [
        {
          type: "text",
          text: "I can open the pull request once GitHub is connected.",
        },
      ],
      metadata: { custom: { turnId: "sample-authorize" } },
    },
  ],
};

/**
 * One natural conversation that surfaces every common thread card in order:
 * user bubble → Worked-for timeline → todos → write preview → task card →
 * approval → ask_question → markdown with citations → composer HITL.
 */
const gallery: ThreadSample = {
  id: "gallery",
  label: "All cards",
  durationEvents: durationEvents(GALLERY_TURN_ID, GALLERY_END),
  waitingAction: {
    kind: "approval",
    title: "The agent is paused until you respond.",
    prompt: "Deploy the timeline default to preview?",
    options: [
      { id: "approve", label: "Allow" },
      { id: "cancel", label: "Deny" },
    ],
  },
  messages: [
    {
      role: "user",
      content: [
        {
          type: "text",
          text: "Ship the timeline default, update the notes, and open a PR when you're ready.",
        },
      ],
    },
    {
      role: "assistant",
      status: { type: "requires-action", reason: "tool-calls" },
      content: [
        {
          type: "reasoning",
          text: "Read the current notes, patch them, run a quick check, delegate the PR wiring, then ask before deploying.",
        },
        toolCall("read_file", { filePath: "notes.md" }),
        toolCall("web_fetch", {
          url: "https://react.dev/reference/rsc",
        }),
        toolCall("web_search", { query: "react cache components" }),
        toolCall("bash", { command: "pnpm test" }),
        toolCall("create_issue", {
          title: "Timeline should default every tool",
          message: "Timeline should default every tool",
        }),
        toolCall(
          "todo",
          { todos: TODOS },
          { result: { todos: TODOS } },
        ),
        toolCall("write_file", {
          filePath: "notes.md",
          content:
            "# Notes\n\n- Timeline is the default tool row\n- Worked for stays for multi-step turns\n- Approvals, todos, and task cards stay as their own surfaces\n",
        }),
        toolCall(
          "coder",
          { message: "Wire isTimelineToolCall through the thread renderer and drop ToolGroup" },
          { toolCallId: "sample-coder-1" },
        ),
        approveConfirm,
        chooseQuestion,
        {
          type: "text",
          text: `Here's the layout after the change:

1. Timeline steps stay quiet under **Worked for**.
2. Todos, write previews, and task cards keep their own chrome.
3. Approvals and questions stay open until you answer.

See [1](https://react.dev/reference/rsc "React docs") and [2](https://docs.expo.dev "Expo docs") for the related docs.`,
        },
      ],
      metadata: { custom: { turnId: GALLERY_TURN_ID } },
    },
  ],
};

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
  durationEvents: durationEvents(MIXED_TURN_ID, MIXED_END),
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

export const THREAD_SAMPLES: readonly ThreadSample[] = [
  approve,
  choose,
  ask,
  questions,
  authorize,
  gallery,
  oneRead,
  mixed,
];

export function threadSample(id: ThreadSampleId): ThreadSample {
  return THREAD_SAMPLES.find((sample) => sample.id === id) ?? approve;
}

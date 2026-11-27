"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuiState } from "@assistant-ui/react";
import { useEveAgents, useEveEvents } from "@assistant-ui/eve";
import type { ConversationAgentSession } from "eve/client";

import {
  deriveSubagentRuns,
  STALE_REVIEW_S,
  type SubagentRun,
} from "@/lib/agent/subagent-runs";
import {
  deriveSubagentRowContent,
  SUBAGENT_CANCELLED_LABEL,
  SUBAGENT_WORKING_ACTIVITY,
  subagentRowTitle,
} from "@/lib/chat/subagent-row";
import { extractCoderHandoff } from "@/lib/chat/coder-receipt";
import {
  subagentMessageBlocks,
  type SubagentPreviewMessage,
} from "@/lib/chat/subagent-preview";
import {
  stabilizeSubagentRuns,
  TASK_PAGE_SIZE,
} from "@/lib/chat/task-elapsed";
import { cn } from "@/lib/utils";
import { extractWatchHandles } from "@/lib/watch/deploy";
import {
  TaskCard,
  type TaskCardState,
} from "@/components/assistant-ui/elements/task-card";
import { CoderSettledReceipt } from "@/components/assistant-ui/elements/coder-receipt";
import { DeployWatchStack } from "@/components/assistant-ui/elements/deploy-watch-card";
import { mono } from "@/components/assistant-ui/elements/surfaces";

// Runtime binding for the task-card element (docs: elements/task-card).
//
// Delegated subagent work renders as a paper task card. The row state cannot
// come from the tool-call part alone: a delegation's tool call completes
// immediately with a "working" receipt, so the part reads "done" while the
// subagent still runs. The real lifecycle lives in the persisted subagent
// event stream, keyed by the delegation's call id. Live activity comes from
// the followed child session (`followAgents`).

type TaskRuns = readonly SubagentRun[];

const TaskRunsContext = createContext<TaskRuns>([]);

export function useSubagentRuns(): TaskRuns {
  return useContext(TaskRunsContext);
}

function subagentEventsKey(events: readonly unknown[]): string {
  let count = 0;
  let lastType = "";
  let lastCallId = "";
  for (const raw of events) {
    const event = raw as {
      readonly type?: string;
      readonly data?: { readonly callId?: string };
    };
    if (
      event.type === "subagent.called" ||
      event.type === "subagent.completed" ||
      event.type === "task.started" ||
      event.type === "task.ended" ||
      event.type === "child.opened" ||
      event.type === "call.settled"
    ) {
      count += 1;
      lastType = event.type ?? "";
      lastCallId = event.data?.callId ?? "";
    }
  }
  return `${count}:${lastType}:${lastCallId}`;
}

export function SubagentRunsProvider({ children }: { children: ReactNode }) {
  const events = useEveEvents();
  const [staleTick, setStaleTick] = useState(0);
  const prevRunsRef = useRef<TaskRuns | undefined>(undefined);
  const prevEventsRef = useRef<readonly unknown[] | null>(null);
  const eventsKey = subagentEventsKey(events);

  if (prevEventsRef.current !== events) {
    if (prevEventsRef.current !== null) {
      prevRunsRef.current = undefined;
    }
    prevEventsRef.current = events;
  }

  const runs = useMemo(() => {
    const next = deriveSubagentRuns(events, Date.now());
    const stabilized = stabilizeSubagentRuns(prevRunsRef.current, next);
    prevRunsRef.current = stabilized;
    return stabilized;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- events keyed via events + eventsKey
  }, [events, eventsKey, staleTick]);

  // Schedule one timer for the earliest undelivered run that will cross the
  // stale threshold. Do not tick at 1 Hz — that remounted every task card.
  useEffect(() => {
    const undelivered = runs.filter((run) => run.delivered === false);
    if (undelivered.length === 0) return;
    const nextAt = Math.min(
      ...undelivered.map((run) => run.at + STALE_REVIEW_S * 1000),
    );
    const delay = Math.max(50, nextAt - Date.now() + 25);
    const timer = window.setTimeout(() => setStaleTick((n) => n + 1), delay);
    return () => window.clearTimeout(timer);
  }, [runs]);

  return (
    <TaskRunsContext.Provider value={runs}>{children}</TaskRunsContext.Provider>
  );
}

// Declared subagents under agent/subagents/* plus eve's built-in `agent`.
export const DELEGATION_TOOLS = new Set([
  "agent",
  "coder",
  "designer",
  "editor",
  "list-builder",
  "mail",
  "researcher",
  "reviewer",
  "updates",
]);

type ToolCallPartState = {
  readonly type: "tool-call";
  readonly toolName: string;
  readonly toolCallId?: string;
  readonly args?: unknown;
  readonly status: { readonly type: string };
  readonly isError?: boolean;
  readonly result?: unknown;
};

function isDelegationPart(part: unknown): part is ToolCallPartState {
  return (
    typeof part === "object" &&
    part !== null &&
    (part as { type?: string }).type === "tool-call" &&
    DELEGATION_TOOLS.has((part as { toolName?: string }).toolName ?? "")
  );
}

function delegationMessage(part: ToolCallPartState): string | undefined {
  const args = (part.args ?? {}) as { message?: unknown };
  return typeof args.message === "string" ? args.message : undefined;
}

function partLooksCancelled(part: ToolCallPartState): boolean {
  if (!part.isError) return false;
  const result = part.result;
  if (!result || typeof result !== "object") return false;
  const error = (result as { error?: unknown }).error;
  return typeof error === "string" && /cancel/i.test(error);
}

function taskState(part: ToolCallPartState, run?: SubagentRun): TaskCardState {
  if (run?.state === "cancelled" || partLooksCancelled(part)) {
    return "cancelled";
  }
  if (run) {
    if (run.state === "running") return "working";
    if (run.state === "failed") return "failed";
    return "done";
  }
  if (part.status.type === "running") return "working";
  return "done";
}

function agentForCall(
  agents: Readonly<Record<string, ConversationAgentSession>> | undefined,
  callId: string | undefined,
): ConversationAgentSession | undefined {
  if (!agents || !callId) return undefined;
  return Object.values(agents).find((agent) => {
    if (agent.callId === callId) return true;
    return "callId" in agent.owner && agent.owner.callId === callId;
  });
}

function childMessagesFor(
  agent: ConversationAgentSession | undefined,
): readonly {
  readonly parts?: readonly {
    readonly type?: string;
    readonly name?: string;
    readonly input?: unknown;
    readonly state?: string;
    readonly output?: unknown;
  }[];
}[] {
  if (!agent || agent.observation.status === "not-followed") return [];
  return agent.observation.conversation.messages;
}

function coderWatches(agent: ConversationAgentSession | undefined) {
  const handles = extractWatchHandles({
    childMessages: childMessagesFor(agent),
  });
  return [handles.vercel, handles.eas].filter(
    (snap): snap is NonNullable<typeof snap> => snap != null,
  );
}

function useStickyResult(node: ReactNode): ReactNode {
  const held = useRef<ReactNode>(undefined);
  if (node !== undefined && node !== null && node !== false) {
    held.current = node;
  }
  return node !== undefined && node !== null && node !== false
    ? node
    : held.current;
}

function coderResult(input: {
  readonly state: TaskCardState;
  readonly run?: SubagentRun;
  readonly agent?: ConversationAgentSession;
  readonly isCoder: boolean;
}): ReactNode {
  const { state, run, agent, isCoder } = input;
  if (state === "cancelled") return SUBAGENT_CANCELLED_LABEL;
  if (state === "failed") {
    return "no result arrived — the run was likely interrupted; ask again";
  }
  if (state === "working" || state === "waiting") return undefined;
  if (!isCoder) return undefined;
  const handoff = extractCoderHandoff({
    runResult: run?.result,
    childMessages: childMessagesFor(agent),
  });
  if (handoff) return <CoderSettledReceipt handoff={handoff} />;
  return undefined;
}

function TaskTranscript({
  agent,
  modelLabel,
}: {
  readonly agent: ConversationAgentSession | undefined;
  readonly modelLabel?: string | undefined;
}) {
  const messages = childMessagesFor(agent) as readonly SubagentPreviewMessage[];
  const blocks = useMemo(() => subagentMessageBlocks(messages), [messages]);
  if (blocks.length === 0 && !modelLabel) {
    return (
      <p className="text-muted-foreground text-xs">No transcript yet.</p>
    );
  }
  return (
    <div className="flex max-h-64 flex-col gap-2 overflow-y-auto">
      {modelLabel ? (
        <p className={cn(mono, "text-muted-foreground")}>{modelLabel}</p>
      ) : null}
      {blocks.map((block) => (
        <div
          key={block.id}
          data-slot="aui_task-transcript-message"
          data-role={block.role}
          className="flex flex-col gap-0.5 text-xs leading-relaxed"
        >
          <span className={cn(mono, "text-muted-foreground")}>
            {block.role === "user" ? "instruction" : "agent"}
          </span>
          {block.lines.map((line, index) => (
            <p key={`${block.id}-${index}`} className="text-foreground/75">
              {line}
            </p>
          ))}
        </div>
      ))}
    </div>
  );
}

function DelegationLane({
  part,
  run,
  agent,
}: {
  readonly part: ToolCallPartState;
  readonly run?: SubagentRun;
  readonly agent?: ConversationAgentSession;
}) {
  const state = taskState(part, run);
  const isCoder = part.toolName === "coder" || run?.name === "coder";
  const agentName = run?.name ?? part.toolName;
  const title = subagentRowTitle(delegationMessage(part), agentName);
  const row = deriveSubagentRowContent({ title, child: agent });
  const live = state === "working" || state === "waiting";
  const activity = live
    ? (row.activity ?? SUBAGENT_WORKING_ACTIVITY)
    : undefined;
  const watches = isCoder ? coderWatches(agent) : [];
  const rawResult = coderResult({ state, run, agent, isCoder });
  const result = useStickyResult(rawResult);
  const hasChild =
    agent != null && agent.observation.status !== "not-followed";

  return (
    <div className={cn("flex flex-col gap-2", isCoder && "max-w-xl")}>
      <TaskCard
        label={row.title}
        meta={agentName}
        activity={activity}
        state={state}
        startedAt={run?.at}
        result={result}
      >
        {hasChild ? (
          <TaskTranscript agent={agent} modelLabel={row.modelLabel} />
        ) : undefined}
      </TaskCard>
      {watches.length > 0 ? <DeployWatchStack handles={watches} /> : null}
    </div>
  );
}

// The lane renderer for delegated tool calls. Thread routes a group whose
// parts are all delegations here instead of the tool group.
export function TaskGroup({
  group,
}: {
  group: { readonly indices: readonly number[] };
}) {
  const runs = useSubagentRuns();
  const agents = useEveAgents();
  const parts = useAuiState((s) => s.message.parts) as readonly unknown[];
  const [visible, setVisible] = useState(TASK_PAGE_SIZE);

  const delegations = group.indices
    .map((index) => parts[index])
    .filter(isDelegationPart);
  if (delegations.length === 0) return null;

  const laneStates = delegations.map((part) => {
    const run = runs.find((r) => r.callId === part.toolCallId);
    return taskState(part, run);
  });
  const running = laneStates.filter(
    (s) => s === "working" || s === "waiting",
  ).length;
  const failed = laneStates.filter((s) => s === "failed").length;
  const waiting = laneStates.filter((s) => s === "waiting").length;

  const shown = delegations.slice(0, visible);
  const hidden = delegations.length - shown.length;
  const summary =
    delegations.length > 1
      ? [
          `${delegations.length} tasks`,
          running > 0 && `${running} running`,
          waiting > 0 && `${waiting} waiting`,
          failed > 0 && `${failed} failed`,
        ]
          .filter((entry): entry is string => typeof entry === "string")
          .join(" · ")
      : null;

  return (
    <div data-slot="aui_task-group" className="flex w-full flex-col gap-2">
      {summary ? (
        <div
          data-slot="aui_task-group-summary"
          className="text-muted-foreground px-1 text-xs"
        >
          {summary}
        </div>
      ) : null}
      {shown.map((part) => {
        const run = runs.find((r) => r.callId === part.toolCallId);
        const agent = agentForCall(agents, part.toolCallId);
        return (
          <DelegationLane
            key={part.toolCallId ?? part.toolName}
            part={part}
            run={run}
            agent={agent}
          />
        );
      })}
      {hidden > 0 ? (
        <button
          type="button"
          data-slot="aui_task-group-more"
          onClick={() => setVisible((count) => count + TASK_PAGE_SIZE)}
          className="text-muted-foreground hover:text-foreground w-fit px-1 text-xs transition-colors"
        >
          Show {Math.min(hidden, TASK_PAGE_SIZE)} more
        </button>
      ) : null}
    </div>
  );
}

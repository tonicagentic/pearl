"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuiState } from "@assistant-ui/react";
import { useEveAgents, useEveEvents } from "@assistant-ui/eve";
import type { ConversationAgentSession } from "eve/client";

import {
  deriveSubagentRuns,
  type SubagentRun,
} from "@/lib/agent/subagent-runs";
import {
  deriveSubagentRowContent,
  SUBAGENT_CANCELLED_LABEL,
  SUBAGENT_WORKING_ACTIVITY,
  subagentRowTitle,
  WAITING_FOR_SUBAGENT_LABEL,
} from "@/lib/chat/subagent-row";
import { extractCoderHandoff } from "@/lib/chat/coder-receipt";
import { cn } from "@/lib/utils";
import { extractWatchHandles } from "@/lib/watch/deploy";
import {
  TaskCard,
  type TaskCardState,
} from "@/components/assistant-ui/elements/task-card";
import { CoderSettledReceipt } from "@/components/assistant-ui/elements/coder-receipt";
import { DeployWatchStack } from "@/components/assistant-ui/elements/deploy-watch-card";
import { threadMeta } from "@/components/assistant-ui/elements/surfaces";

// Runtime binding for the task-card element (docs: elements/task-card).
//
// Delegated subagent work renders as a flat row instead of timeline steps.
// The row state cannot come from the tool-call part alone: a delegation's
// tool call completes immediately with a "working" receipt, so the part reads
// "done" while the subagent still runs. The real lifecycle lives in the
// persisted subagent event stream, keyed by the delegation's call id. Live
// model + activity come from the followed child session (`followAgents`).

type TaskRuns = readonly SubagentRun[];

const TaskRunsContext = createContext<TaskRuns>([]);

export function useSubagentRuns(): TaskRuns {
  return useContext(TaskRunsContext);
}

export function SubagentRunsProvider({ children }: { children: ReactNode }) {
  const events = useEveEvents();
  const [now, setNow] = useState<number | null>(null);

  const runs = useMemo(
    () => deriveSubagentRuns(events, now ?? Number.MAX_SAFE_INTEGER),
    [events, now],
  );

  // Tick while any run is undelivered. Keying on the post-derivation state
  // deadlocks: with now null the staleness check marks undelivered runs as
  // failed before the first tick, so no run is ever "running" to trigger it.
  const anyUndelivered = runs.some((run) => run.delivered === false);

  useEffect(() => {
    if (!anyUndelivered) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [anyUndelivered]);

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
  // The event stream is the source of truth for background runs; the part
  // status only covers delegations with no observed run (older threads).
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
  // Live watches render beside the row (not inside the result chrome).
  if (state === "working" || state === "waiting") return undefined;
  if (!isCoder) return undefined;
  const handoff = extractCoderHandoff({
    runResult: run?.result,
    childMessages: childMessagesFor(agent),
  });
  if (handoff) return <CoderSettledReceipt handoff={handoff} />;
  return undefined;
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

  const delegations = group.indices
    .map((index) => parts[index])
    .filter(isDelegationPart);
  if (delegations.length === 0) return null;

  const anyLive = delegations.some((part) => {
    const run = runs.find((r) => r.callId === part.toolCallId);
    const state = taskState(part, run);
    return state === "working" || state === "waiting";
  });

  return (
    <div data-slot="aui_task-group" className="flex flex-col gap-2 px-2">
      {delegations.map((part) => {
        const run = runs.find((r) => r.callId === part.toolCallId);
        const state = taskState(part, run);
        const agent = agentForCall(agents, part.toolCallId);
        const isCoder = part.toolName === "coder" || run?.name === "coder";
        const title = subagentRowTitle(
          delegationMessage(part),
          run?.name ?? part.toolName,
        );
        const row = deriveSubagentRowContent({ title, child: agent });
        const live = state === "working" || state === "waiting";
        const activity = live
          ? (row.activity ?? SUBAGENT_WORKING_ACTIVITY)
          : undefined;
        const watches = isCoder ? coderWatches(agent) : [];
        return (
          <div
            key={part.toolCallId}
            className={cn("flex flex-col gap-2", isCoder && "max-w-xl")}
          >
            <TaskCard
              label={row.title}
              modelLabel={row.modelLabel}
              activity={activity}
              state={state}
              result={coderResult({ state, run, agent, isCoder })}
            />
            {watches.length > 0 ? (
              <DeployWatchStack handles={watches} />
            ) : null}
          </div>
        );
      })}
      {anyLive ? (
        <div className={threadMeta} data-slot="aui_task-waiting">
          <span className="text-foreground/35 text-[12.5px]">
            {WAITING_FOR_SUBAGENT_LABEL}
          </span>
        </div>
      ) : null}
    </div>
  );
}

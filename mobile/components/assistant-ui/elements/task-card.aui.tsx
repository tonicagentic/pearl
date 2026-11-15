import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { View } from "react-native";
import { useAuiState } from "@assistant-ui/react-native";

import {
  deriveSubagentRuns,
  type SubagentRun,
} from "@/src/subagent-runs";
import { useEveEvents } from "@/src/chat-context";
import {
  agentForCall,
  useChatConversation,
} from "@/src/conversation-context";
import { pendingForDelegation } from "@/src/message-projection";
import { latestSubagentPreviewLine } from "@/src/subagent-preview";
import { useSubagentInspect } from "@/src/subagent-inspect-context";
import {
  deriveCoderJobProgress,
  extractCoderHandoff,
} from "../../../../lib/chat/coder-receipt";
import { CoderSettledReceipt, CoderWorkingReceipt } from "./coder-receipt";
import { TaskCard, type TaskCardState } from "./task-card";

// Runtime binding for the task-card element (docs: elements/task-card) —
// RN port of the web's task-card.aui.
//
// Delegated subagent work renders as task cards instead of timeline steps.
// The card state cannot come from the tool-call part alone: a delegation's
// tool call completes immediately with a "working" receipt, so the part reads
// "done" while the subagent still runs. The real lifecycle lives in the
// persisted subagent event stream (subagent.called / subagent.completed),
// derived into runs keyed by the delegation's call id. Open person-waits on
// the tool part or a followed child override the card to "waiting".

type TaskRuns = readonly SubagentRun[];

type SubagentRunsContextValue = {
  readonly runs: TaskRuns;
  /** Shared 1 Hz clock while any run is undelivered / in-flight. */
  readonly now: number;
};

const TaskRunsContext = createContext<SubagentRunsContextValue>({
  runs: [],
  now: 0,
});

export function useSubagentRuns(): TaskRuns {
  return useContext(TaskRunsContext).runs;
}

function useSubagentClock(): number {
  return useContext(TaskRunsContext).now;
}

/** Only re-derive when the event log gains/loses subagent-shaped rows. */
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
      event.type === "subagent.completed"
    ) {
      count += 1;
      lastType = event.type;
      lastCallId = event.data?.callId ?? "";
    }
  }
  return `${count}:${lastType}:${lastCallId}`;
}

export function SubagentRunsProvider({ children }: { readonly children: ReactNode }) {
  const events = useEveEvents();
  const [now, setNow] = useState(() => Date.now());
  // Gate full-log scans: content.delta does not change this key, so `runs`
  // keeps its prior identity across ordinary stream ticks.
  const eventsKey = subagentEventsKey(events);
  const runs = useMemo(
    () => deriveSubagentRuns(events, now),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- events keyed via eventsKey
    [eventsKey, now],
  );

  // Tick while any run is undelivered (keying on the post-derivation state
  // deadlocks — see the web element). Also covers in-flight elapsed labels so
  // TaskGroup does not need a second interval.
  const anyUndelivered = runs.some((run) => run.delivered === false);
  const anyRunning = runs.some((run) => run.state === "running");

  useEffect(() => {
    if (!anyUndelivered && !anyRunning) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [anyUndelivered, anyRunning]);

  const value = useMemo(() => ({ runs, now }), [runs, now]);

  return (
    <TaskRunsContext.Provider value={value}>{children}</TaskRunsContext.Provider>
  );
}

function formatElapsed(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.round(minutes / 60)}h`;
}

// Declared subagents under agent/subagents/* plus eve's built-in `agent`.
export const DELEGATION_TOOLS = new Set([
  "agent",
  "coder",
  "editor",
  "researcher",
  "reviewer",
]);

type ToolCallPartState = {
  readonly type: "tool-call";
  readonly toolName: string;
  readonly toolCallId?: string;
  readonly args?: unknown;
  readonly status: { readonly type: string };
};

function isDelegationPart(part: unknown): part is ToolCallPartState {
  return (
    typeof part === "object" &&
    part !== null &&
    (part as { type?: string }).type === "tool-call" &&
    DELEGATION_TOOLS.has((part as { toolName?: string }).toolName ?? "")
  );
}

function taskLabel(part: ToolCallPartState): string {
  const args = (part.args ?? {}) as { message?: unknown };
  const raw =
    typeof args.message === "string" ? args.message.split("\n")[0].trim() : "";
  if (!raw) return part.toolName;
  return raw.length > 80 ? `${raw.slice(0, 77).trimEnd()}…` : raw;
}

function taskMeta(part: ToolCallPartState, run?: SubagentRun): string {
  return run?.name ?? part.toolName;
}

function taskState(
  part: ToolCallPartState,
  run: SubagentRun | undefined,
  waiting: boolean,
): TaskCardState {
  if (waiting) return "waiting";
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

function childMessagesFor(
  agent: ReturnType<typeof agentForCall>,
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

function coderResult(input: {
  readonly label: string;
  readonly state: TaskCardState;
  readonly run?: SubagentRun;
  readonly agent: ReturnType<typeof agentForCall>;
  readonly waitPrompt?: string;
}): ReactNode {
  const { label, state, run, agent, waitPrompt } = input;
  if (waitPrompt) return waitPrompt;
  if (state === "failed") {
    return "no result arrived — the run was likely interrupted; ask again";
  }

  const messages = childMessagesFor(agent);
  if (state === "working" || state === "waiting") {
    const livePreview = latestSubagentPreviewLine(agent);
    const progress = deriveCoderJobProgress(messages, livePreview);
    return <CoderWorkingReceipt title={label} progress={progress} />;
  }

  const handoff = extractCoderHandoff({
    runResult: run?.result,
    childMessages: messages,
  });
  if (handoff) return <CoderSettledReceipt handoff={handoff} />;
  return undefined;
}

// The lane renderer for delegated tool calls. Thread routes a group whose
// parts are all delegations here instead of the tool group.
export function TaskGroup({
  group,
}: {
  readonly group: { readonly indices: readonly number[] };
}) {
  const runs = useSubagentRuns();
  const clock = useSubagentClock();
  const { conversation } = useChatConversation();
  const { open } = useSubagentInspect();
  const parts = useAuiState((s) => s.message.parts) as readonly unknown[];

  const delegations = group.indices
    .map((index) => parts[index])
    .filter(isDelegationPart);
  if (delegations.length === 0) return null;

  return (
    <View className="flex-col gap-2 px-2">
      {delegations.map((part) => {
        const run = runs.find((r) => r.callId === part.toolCallId);
        const wait = pendingForDelegation(conversation, part.toolCallId);
        const state = taskState(part, run, wait != null);
        const working = state === "working";
        const elapsed =
          run !== undefined && (working || state === "waiting")
            ? formatElapsed((clock || run.at) - run.at)
            : undefined;
        const agent = agentForCall(conversation.agents, part.toolCallId);
        const isCoder =
          part.toolName === "coder" || run?.name === "coder";
        const label = taskLabel(part);
        const livePreview = working ? latestSubagentPreviewLine(agent) : null;
        return (
          <TaskCard
            key={part.toolCallId}
            label={label}
            meta={taskMeta(part, run)}
            state={state}
            elapsed={elapsed}
            className={isCoder ? "max-w-xl" : undefined}
            onPress={() => {
              open({
                sessionId: agent?.sessionId ?? part.toolCallId ?? part.toolName,
                name: taskMeta(part, run),
                callId: part.toolCallId,
                agent,
              });
            }}
            result={
              isCoder
                ? coderResult({
                    label,
                    state,
                    run,
                    agent,
                    waitPrompt: wait?.prompt,
                  })
                : wait
                  ? wait.prompt
                  : run?.state === "failed"
                    ? "no result arrived — the run was likely interrupted; ask again"
                    : working
                      ? (livePreview ?? `Waiting on ${taskMeta(part, run)}…`)
                      : undefined
            }
          />
        );
      })}
    </View>
  );
}

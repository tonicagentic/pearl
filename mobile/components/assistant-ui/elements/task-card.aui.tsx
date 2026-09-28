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
import { TaskCard, type TaskCardState } from "./task-card";

// Runtime binding for the task-card element (docs: elements/task-card) —
// RN port of the web's task-card.aui.
//
// Delegated subagent work renders as task cards instead of timeline steps.
// The card state cannot come from the tool-call part alone: a delegation's
// tool call completes immediately with a "working" receipt, so the part reads
// "done" while the subagent still runs. The real lifecycle lives in the
// persisted subagent event stream (subagent.called / subagent.completed),
// derived into runs keyed by the delegation's call id.

type TaskRuns = readonly SubagentRun[];

const TaskRunsContext = createContext<TaskRuns>([]);

export function useSubagentRuns(): TaskRuns {
  return useContext(TaskRunsContext);
}

export function SubagentRunsProvider({ children }: { readonly children: ReactNode }) {
  const events = useEveEvents();
  const [now, setNow] = useState<number | null>(null);

  const runs = useMemo(
    () => deriveSubagentRuns(events, now ?? Number.MAX_SAFE_INTEGER),
    [events, now],
  );

  // Tick while any run is undelivered (keying on the post-derivation state
  // deadlocks — see the web element).
  const anyUndelivered = runs.some((run) => run.delivered === false);

  useEffect(() => {
    if (!anyUndelivered) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [anyUndelivered]);

  return (
    <TaskRunsContext.Provider value={runs}>{children}</TaskRunsContext.Provider>
  );
}

function formatElapsed(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.round(minutes / 60)}h`;
}

// A delegation tool call: the eve built-in `agent` tool and the editor
// subagent it fronts. Kept in sync with agent/subagents.
export const DELEGATION_TOOLS = new Set(["agent", "editor"]);

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
  const message =
    typeof args.message === "string" ? args.message.split("\n")[0] : "";
  return message || part.toolName;
}

function taskMeta(part: ToolCallPartState, run?: SubagentRun): string {
  return run?.name ?? part.toolName;
}

function taskState(part: ToolCallPartState, run?: SubagentRun): TaskCardState {
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

// The lane renderer for delegated tool calls. Thread routes a group whose
// parts are all delegations here instead of the tool group.
export function TaskGroup({
  group,
}: {
  readonly group: { readonly indices: readonly number[] };
}) {
  const runs = useSubagentRuns();
  const parts = useAuiState((s) => s.message.parts) as readonly unknown[];
  const now = useNowWhileWorking(group, parts, runs);

  const delegations = group.indices
    .map((index) => parts[index])
    .filter(isDelegationPart);
  if (delegations.length === 0) return null;

  return (
    <View className="flex-col gap-2 px-2">
      {delegations.map((part) => {
        const run = runs.find((r) => r.callId === part.toolCallId);
        const working = taskState(part, run) === "working";
        const elapsed =
          run !== undefined
            ? formatElapsed((now ?? run.at) - run.at)
            : undefined;
        return (
          <TaskCard
            key={part.toolCallId}
            label={taskLabel(part)}
            meta={taskMeta(part, run)}
            state={taskState(part, run)}
            elapsed={elapsed}
            // The transcript lives in the child session, not in this part;
            // the card stays a compact status row with its result below.
            result={
              run?.state === "failed"
                ? "no result arrived — the run was likely interrupted; ask for the review again"
                : working
                  ? "working — the reply will land in this thread when it finishes"
                  : undefined
            }
          />
        );
      })}
    </View>
  );
}

// Ticking clock for in-flight runs, shared by all cards in the lane.
function useNowWhileWorking(
  group: { readonly indices: readonly number[] },
  parts: readonly unknown[],
  runs: TaskRuns,
): number | null {
  const [now, setNow] = useState<number | null>(null);
  const anyWorking = group.indices.some((index) => {
    const part = parts[index];
    if (!isDelegationPart(part)) return false;
    const run = runs.find((r) => r.callId === part.toolCallId);
    return taskState(part, run) === "working";
  });

  useEffect(() => {
    if (!anyWorking) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [anyWorking]);

  return now;
}

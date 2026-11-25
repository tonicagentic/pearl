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
import { useSubagentInspect } from "@/src/subagent-inspect-context";
import { extractCoderHandoff } from "../../../../lib/chat/coder-receipt";
import {
  deriveSubagentRowContent,
  subagentRowTitle,
  WAITING_FOR_SUBAGENT_LABEL,
} from "../../../../lib/chat/subagent-row";
import { extractWatchHandles } from "../../../../lib/watch/deploy";
import { CoderSettledReceipt } from "./coder-receipt";
import { DeployWatchStack } from "./deploy-watch-card";
import { Text } from "@/components/ui/text";
import { TaskCard, type TaskCardState } from "./task-card";

// Runtime binding for the task-card element (docs: elements/task-card) —
// RN port of the web's task-card.aui.
//
// Delegated subagent work renders as a flat row instead of timeline steps.
// The row state cannot come from the tool-call part alone: a delegation's
// tool call completes immediately with a "working" receipt, so the part reads
// "done" while the subagent still runs. The real lifecycle lives in the
// persisted subagent event stream, keyed by the delegation's call id. Open
// person-waits on the tool part or a followed child override the card to
// "waiting". Live model + activity come from the followed child session.

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
      event.type === "subagent.completed" ||
      event.type === "task.started" ||
      event.type === "task.ended" ||
      event.type === "child.opened"
    ) {
      count += 1;
      lastType = event.type ?? "";
      lastCallId = event.data?.callId ?? "";
    }
  }
  return `${count}:${lastType}:${lastCallId}`;
}

export function SubagentRunsProvider({
  children,
}: {
  readonly children: ReactNode;
}) {
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
  // deadlocks — see the web element).
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

function delegationMessage(part: ToolCallPartState): string | undefined {
  const args = (part.args ?? {}) as { message?: unknown };
  return typeof args.message === "string" ? args.message : undefined;
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

function coderWatches(agent: ReturnType<typeof agentForCall>) {
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
  readonly agent: ReturnType<typeof agentForCall>;
  readonly waitPrompt?: string;
  readonly isCoder: boolean;
}): ReactNode {
  const { state, run, agent, waitPrompt, isCoder } = input;
  if (waitPrompt) return waitPrompt;
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

// The lane renderer for delegated tool calls. Thread routes a group whose
// parts are all delegations here instead of the tool group.
export function TaskGroup({
  group,
}: {
  readonly group: { readonly indices: readonly number[] };
}) {
  const runs = useSubagentRuns();
  const { conversation } = useChatConversation();
  const { open } = useSubagentInspect();
  const parts = useAuiState((s) => s.message.parts) as readonly unknown[];

  const delegations = group.indices
    .map((index) => parts[index])
    .filter(isDelegationPart);
  if (delegations.length === 0) return null;

  const anyLive = delegations.some((part) => {
    const run = runs.find((r) => r.callId === part.toolCallId);
    const wait = pendingForDelegation(conversation, part.toolCallId);
    const state = taskState(part, run, wait != null);
    return state === "working" || state === "waiting";
  });

  return (
    <View className="flex-col gap-2 px-2">
      {delegations.map((part) => {
        const run = runs.find((r) => r.callId === part.toolCallId);
        const wait = pendingForDelegation(conversation, part.toolCallId);
        const state = taskState(part, run, wait != null);
        const agent = agentForCall(conversation.agents, part.toolCallId);
        const isCoder = part.toolName === "coder" || run?.name === "coder";
        const title = subagentRowTitle(
          delegationMessage(part),
          run?.name ?? part.toolName,
        );
        const row = deriveSubagentRowContent({ title, child: agent });
        const live = state === "working" || state === "waiting";
        const watches = isCoder ? coderWatches(agent) : [];
        return (
          <View
            key={part.toolCallId}
            className={isCoder ? "max-w-xl flex-col gap-2" : "flex-col gap-2"}
          >
            <TaskCard
              label={row.title}
              modelLabel={row.modelLabel}
              activity={live ? row.activity : undefined}
              state={state}
              onPress={() => {
                open({
                  sessionId:
                    agent?.sessionId ?? part.toolCallId ?? part.toolName,
                  name: run?.name ?? part.toolName,
                  callId: part.toolCallId,
                  agent,
                });
              }}
              result={coderResult({
                state,
                run,
                agent,
                waitPrompt: wait?.prompt,
                isCoder,
              })}
            />
            {watches.length > 0 ? (
              <DeployWatchStack handles={watches} />
            ) : null}
          </View>
        );
      })}
      {anyLive ? (
        <Text variant="caption" tone="default" className="opacity-35">
          {WAITING_FOR_SUBAGENT_LABEL}
        </Text>
      ) : null}
    </View>
  );
}

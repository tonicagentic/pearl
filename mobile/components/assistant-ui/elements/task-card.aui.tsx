import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { Pressable, View } from "react-native";
import { useAuiState } from "@assistant-ui/react-native";

import {
  deriveSubagentRuns,
  STALE_REVIEW_S,
  type SubagentRun,
} from "@/src/subagent-runs";
import { useActiveChat, useEveEvents } from "@/src/chat-context";
import {
  agentForCall,
  useChatConversation,
} from "@/src/conversation-context";
import { pendingForDelegation } from "@/src/message-projection";
import { useSubagentInspect } from "@/src/subagent-inspect-context";
import { extractCoderHandoff } from "../../../../lib/chat/coder-receipt";
import {
  deriveSubagentRowContent,
  SUBAGENT_CANCELLED_LABEL,
  SUBAGENT_WORKING_ACTIVITY,
  subagentRowTitle,
} from "../../../../lib/chat/subagent-row";
import {
  stabilizeSubagentRuns,
  TASK_PAGE_SIZE,
} from "../../../../lib/chat/task-elapsed";
import { extractWatchHandles } from "../../../../lib/watch/deploy";
import { CoderSettledReceipt } from "./coder-receipt";
import { DeployWatchStack } from "./deploy-watch-card";
import { Text } from "@/components/ui/text";
import { TaskCard, type TaskCardState } from "./task-card";

// Runtime binding for the task-card element (docs: elements/task-card) —
// RN port of the web's task-card.aui.
//
// Delegated subagent work renders as a paper task card. The row state cannot
// come from the tool-call part alone: a delegation's tool call completes
// immediately with a "working" receipt, so the part reads "done" while the
// subagent still runs. The real lifecycle lives in the persisted subagent
// event stream, keyed by the delegation's call id. Opening the header mounts
// the existing transcript sheet (a nested thread on the phone is too heavy).

type TaskRuns = readonly SubagentRun[];

type SubagentRunsContextValue = {
  readonly runs: TaskRuns;
};

const TaskRunsContext = createContext<SubagentRunsContextValue>({
  runs: [],
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

export function SubagentRunsProvider({
  children,
}: {
  readonly children: ReactNode;
}) {
  const events = useEveEvents();
  const [staleTick, setStaleTick] = useState(0);
  const prevRunsRef = useRef<TaskRuns | undefined>(undefined);
  const prevEventsRef = useRef<readonly unknown[] | null>(null);
  const eventsKey = subagentEventsKey(events);

  // Event-array identity changes on chat switch — drop the prior memo so a
  // matching coarse key cannot reuse another session's runs.
  if (prevEventsRef.current !== events) {
    if (
      prevEventsRef.current !== null &&
      prevEventsRef.current !== events
    ) {
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

  useEffect(() => {
    const undelivered = runs.filter((run) => run.delivered === false);
    if (undelivered.length === 0) return;
    const nextAt = Math.min(
      ...undelivered.map((run) => run.at + STALE_REVIEW_S * 1000),
    );
    const delay = Math.max(50, nextAt - Date.now() + 25);
    const timer = setTimeout(() => setStaleTick((n) => n + 1), delay);
    return () => clearTimeout(timer);
  }, [runs]);

  const value = useMemo(() => ({ runs }), [runs]);

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

function eveToolState(
  conversation: ReturnType<typeof useChatConversation>["conversation"],
  callId: string | undefined,
): string | undefined {
  if (!callId) return undefined;
  for (const message of conversation.messages) {
    if (message.role !== "assistant") continue;
    for (const part of message.parts) {
      if (part.type === "tool" && part.callId === callId) {
        return part.state;
      }
    }
  }
  return undefined;
}

function partLooksCancelled(part: ToolCallPartState): boolean {
  if (!part.isError) return false;
  const result = part.result;
  if (!result || typeof result !== "object") return false;
  const error = (result as { error?: unknown }).error;
  return typeof error === "string" && /cancel/i.test(error);
}

function taskState(
  part: ToolCallPartState,
  run: SubagentRun | undefined,
  waiting: boolean,
  eveState: string | undefined,
): TaskCardState {
  if (
    eveState === "cancelled" ||
    run?.state === "cancelled" ||
    partLooksCancelled(part)
  ) {
    return "cancelled";
  }
  if (waiting) return "waiting";
  if (run) {
    if (run.state === "running") return "working";
    if (run.state === "failed") return "failed";
    return "done";
  }
  if (eveState === "failed" || eveState === "rejected") return "failed";
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
  readonly agent: ReturnType<typeof agentForCall>;
  readonly waitPrompt?: string;
  readonly isCoder: boolean;
}): ReactNode {
  const { state, run, agent, waitPrompt, isCoder } = input;
  if (waitPrompt) return waitPrompt;
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

function DelegationLane({
  part,
  run,
  animateEnter,
}: {
  readonly part: ToolCallPartState;
  readonly run?: SubagentRun;
  readonly animateEnter: boolean;
}) {
  const { conversation } = useChatConversation();
  const { open } = useSubagentInspect();
  const wait = pendingForDelegation(conversation, part.toolCallId);
  const eveState = eveToolState(conversation, part.toolCallId);
  const state = taskState(part, run, wait != null, eveState);
  const agent = agentForCall(conversation.agents, part.toolCallId);
  const isCoder = part.toolName === "coder" || run?.name === "coder";
  const agentName = run?.name ?? part.toolName;
  const title = subagentRowTitle(delegationMessage(part), agentName);
  const row = deriveSubagentRowContent({
    title,
    child: agent as Parameters<typeof deriveSubagentRowContent>[0]["child"],
  });
  const live = state === "working" || state === "waiting";
  const activity = live
    ? (row.activity ?? SUBAGENT_WORKING_ACTIVITY)
    : undefined;
  const watches = isCoder ? coderWatches(agent) : [];
  const rawResult = coderResult({
    state,
    run,
    agent,
    waitPrompt: wait?.prompt,
    isCoder,
  });
  const result = useStickyResult(rawResult);

  return (
    <View className={isCoder ? "max-w-xl flex-col gap-2" : "flex-col gap-2"}>
      <TaskCard
        label={row.title}
        meta={agentName}
        activity={activity}
        state={state}
        startedAt={run?.at}
        animateEnter={animateEnter}
        expandable
        onPress={() => {
          open({
            sessionId: agent?.sessionId ?? part.toolCallId ?? part.toolName,
            name: agentName,
            callId: part.toolCallId,
            agent,
          });
        }}
        result={result}
      />
      {watches.length > 0 ? <DeployWatchStack handles={watches} /> : null}
    </View>
  );
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
  const { store } = useActiveChat();
  const parts = useAuiState((s) => s.message.parts) as readonly unknown[];
  const [visible, setVisible] = useState(TASK_PAGE_SIZE);
  const enteredIds = useRef(new Set<string>());

  // Skip live chrome while the store is mid-resume so follow/caught-up ticks
  // do not rebuild the card as waiting.
  const catchingUp = useSyncExternalStore(
    (listener) => store.subscribe(listener),
    () => store.snapshot.status === "resuming",
    () => false,
  );

  const delegations = group.indices
    .map((index) => parts[index])
    .filter(isDelegationPart);

  if (delegations.length === 0) return null;

  const laneStates = catchingUp
    ? []
    : delegations.map((part) => {
        const run = runs.find((r) => r.callId === part.toolCallId);
        const wait = pendingForDelegation(conversation, part.toolCallId);
        const eveState = eveToolState(conversation, part.toolCallId);
        return taskState(part, run, wait != null, eveState);
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
    <View className="flex-col gap-2">
      {summary ? (
        <Text variant="caption" tone="default" className="px-1 opacity-55">
          {summary}
        </Text>
      ) : null}
      {shown.map((part) => {
        const callId = part.toolCallId ?? part.toolName;
        const firstMount = !enteredIds.current.has(callId);
        if (firstMount) enteredIds.current.add(callId);
        const run = runs.find((r) => r.callId === part.toolCallId);
        return (
          <DelegationLane
            key={callId}
            part={part}
            run={run}
            animateEnter={firstMount}
          />
        );
      })}
      {hidden > 0 ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => setVisible((count) => count + TASK_PAGE_SIZE)}
          className="px-1"
        >
          <Text variant="caption" tone="default" className="opacity-55">
            Show {Math.min(hidden, TASK_PAGE_SIZE)} more
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

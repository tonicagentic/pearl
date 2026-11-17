/**
 * Live thinking-status derivation for web and mobile.
 *
 * Maps eve v27 stream events + assistant message parts into one user-facing
 * status phrase. Keeps the status line calm with dwell coalescing so rapid
 * deltas do not thrash the 150ms thinking-states swap.
 */

import {
  extractPartialArgString,
  statusLabelForTool,
  type ActivityToolPart,
} from "./thread-activity.ts";

export { extractPartialArgString };

export const THINKING_STATE_DWELL_MS = 650;
export const DEFAULT_THINKING_LABEL = "Thinking";

export type ThinkingStatusType =
  | "running"
  | "complete"
  | "incomplete"
  | "requires-action"
  | string;

export type ThinkingMessagePart = {
  readonly type?: string;
  readonly text?: string;
  readonly toolName?: string;
  readonly args?: unknown;
  readonly argsText?: string;
  readonly label?: string;
  readonly status?: { readonly type?: ThinkingStatusType };
};

export type ThinkingStreamEvent = {
  readonly type?: string;
  readonly data?: {
    readonly runId?: string;
    readonly turnId?: string;
    readonly callId?: string;
    readonly interactionId?: string;
    readonly kind?: string;
    readonly name?: string;
    readonly outcome?: string;
    readonly request?: { readonly kind?: string };
    readonly changeId?: string;
    readonly taskId?: string;
    readonly label?: string;
  };
};

export type ThinkingAgentObservation = {
  readonly status?: string;
  readonly conversation?: {
    readonly messages?: readonly {
      readonly role?: string;
      readonly parts?: readonly ThinkingMessagePart[];
      readonly metadata?: { readonly status?: string };
    }[];
  };
};

export type ThinkingAgentSession = {
  readonly name?: string;
  readonly observation?: ThinkingAgentObservation;
};

export type DeriveLiveThinkingStateInput = {
  readonly events?: readonly ThinkingStreamEvent[];
  readonly parts?: readonly ThinkingMessagePart[];
  readonly agents?: Readonly<Record<string, ThinkingAgentSession>>;
  readonly statusType?: ThinkingStatusType;
  readonly waitingLabel?: string;
  readonly personWaitLabel?: string | null;
  /** When true, reply prose is already the trailing content — yield. */
  readonly answerPhase?: boolean;
};

export type LiveThinkingState = {
  readonly label: string | undefined;
  readonly phase:
    | "idle"
    | "person-wait"
    | "compaction"
    | "retry"
    | "tool"
    | "subagent"
    | "reasoning"
    | "pre-content";
};

/**
 * Pull a concise topic from streaming reasoning. Prefer the latest markdown
 * `**Heading**`, then a short leading clause. Empty / whitespace → null.
 */
export function extractReasoningHeading(
  text: string | undefined,
  { maxLen = 48 }: { readonly maxLen?: number } = {},
): string | null {
  if (!text) return null;
  const trimmed = text.trim();
  if (!trimmed) return null;

  const headings = [...trimmed.matchAll(/\*\*([^*]{2,80})\*\*/g)];
  const lastHeading = headings.at(-1)?.[1]?.trim();
  if (lastHeading) return clipPhrase(lastHeading, maxLen);

  const firstLine = trimmed.split(/\n+/)[0]?.trim() ?? "";
  if (!firstLine) return null;
  // Drop leading list markers / numbering.
  const cleaned = firstLine.replace(/^[-*•\d.)\s]+/, "").trim();
  if (!cleaned) return null;
  // Prefer a clause before a period / em dash when the line is long.
  const clause = cleaned.split(/(?<=[.!?])\s+| — | – |: /)[0]?.trim() ?? cleaned;
  if (clause.length < 3) return null;
  return clipPhrase(clause, maxLen);
}

function clipPhrase(value: string, maxLen: number): string {
  if (value.length <= maxLen) return value;
  const slice = value.slice(0, maxLen - 1);
  const cut = Math.max(slice.lastIndexOf(" "), Math.floor(maxLen * 0.6));
  return `${slice.slice(0, cut).trimEnd()}…`;
}

function asToolPart(part: ThinkingMessagePart): ActivityToolPart | null {
  if (part.type !== "tool-call" || !part.toolName) return null;
  return {
    type: "tool-call",
    toolName: part.toolName,
    args: part.args,
    argsText: part.argsText,
    label: part.label,
    status: part.status,
  };
}

/** Latest non-empty `call.progress` label still tied to an unsettled call. */
function latestCallProgressLabel(
  events: readonly ThinkingStreamEvent[],
): string | undefined {
  const open = new Set<string>();
  const labels = new Map<string, string>();
  for (const event of events) {
    const callId = event.data?.callId;
    if (event.type === "call.started" || event.type === "call.requested") {
      if (callId) open.add(callId);
      continue;
    }
    if (event.type === "call.progress") {
      if (!callId) continue;
      open.add(callId);
      const label = event.data?.label;
      if (typeof label === "string" && label.trim()) {
        labels.set(callId, label.trim());
      }
      continue;
    }
    if (event.type === "call.settled") {
      if (callId) {
        open.delete(callId);
        labels.delete(callId);
      }
      continue;
    }
    if (event.type === "turn.settled" || event.type === "session.ended") {
      open.clear();
      labels.clear();
    }
  }
  for (const callId of [...open].reverse()) {
    const label = labels.get(callId);
    if (label) return label;
  }
  return undefined;
}

function latestOpenInteraction(
  events: readonly ThinkingStreamEvent[],
): ThinkingStreamEvent["data"] | null {
  const open = new Map<string, ThinkingStreamEvent["data"]>();
  for (const event of events) {
    if (event.type === "interaction.opened" && event.data?.interactionId) {
      open.set(event.data.interactionId, event.data);
      continue;
    }
    if (event.type === "interaction.settled" && event.data?.interactionId) {
      open.delete(event.data.interactionId);
      continue;
    }
    if (event.type === "turn.settled" || event.type === "session.ended") {
      open.clear();
    }
  }
  const last = [...open.values()].at(-1);
  return last ?? null;
}

function hasOpenCompaction(events: readonly ThinkingStreamEvent[]): boolean {
  let open = false;
  for (const event of events) {
    if (event.type === "context.started") open = true;
    else if (event.type === "context.settled") open = false;
    else if (event.type === "turn.settled" || event.type === "session.ended") {
      open = false;
    }
  }
  return open;
}

function hasPendingModelRetry(events: readonly ThinkingStreamEvent[]): boolean {
  let pending = false;
  for (const event of events) {
    if (event.type === "model.retried") pending = true;
    else if (
      event.type === "content.delta" ||
      event.type === "content.completed" ||
      event.type === "call.input" ||
      event.type === "call.requested" ||
      event.type === "call.started" ||
      event.type === "call.progress" ||
      event.type === "model.started" ||
      event.type === "model.settled" ||
      event.type === "turn.settled" ||
      event.type === "session.ended"
    ) {
      pending = false;
    }
  }
  return pending;
}

function runningToolLabel(
  parts: readonly ThinkingMessagePart[],
): string | undefined {
  for (let i = parts.length - 1; i >= 0; i -= 1) {
    const part = parts[i];
    if (part?.type !== "tool-call") continue;
    if (part.status?.type && part.status.type !== "running") continue;
    if (part.toolName === "todo") continue;
    const tool = asToolPart(part);
    if (!tool) continue;
    return statusLabelForTool(tool, { live: true });
  }
  return undefined;
}

function streamingReasoningLabel(
  parts: readonly ThinkingMessagePart[],
): string | undefined {
  for (let i = parts.length - 1; i >= 0; i -= 1) {
    const part = parts[i];
    if (part?.type !== "reasoning") continue;
    const heading = extractReasoningHeading(part.text);
    return heading ?? DEFAULT_THINKING_LABEL;
  }
  return undefined;
}

function hasVisibleWork(parts: readonly ThinkingMessagePart[]): boolean {
  return parts.some((part) => {
    if (part.type === "reasoning") return true;
    if (part.type === "tool-call") return true;
    if (part.type === "file" || part.type === "image" || part.type === "data") {
      return true;
    }
    return (
      part.type === "text" &&
      typeof part.text === "string" &&
      part.text.trim().length > 0
    );
  });
}

function activeChildLabel(
  agents: Readonly<Record<string, ThinkingAgentSession>> | undefined,
): string | undefined {
  if (!agents) return undefined;
  for (const agent of Object.values(agents)) {
    const observation = agent.observation;
    if (!observation || observation.status === "not-followed") continue;
    const messages = observation.conversation?.messages ?? [];
    const last = [...messages].reverse().find((message) => message.role === "assistant");
    if (!last) {
      if (agent.name) return `Working with ${agent.name}`;
      continue;
    }
    if (last.metadata?.status === "streaming" || last.metadata?.status === undefined) {
      const tool = runningToolLabel(last.parts ?? []);
      if (tool) return tool;
      if (agent.name) return `Working with ${agent.name}`;
    }
  }
  return undefined;
}

function latestTaskLabel(events: readonly ThinkingStreamEvent[]): string | undefined {
  let openName: string | undefined;
  for (const event of events) {
    if (event.type === "task.started") {
      openName = event.data?.name ?? "subagent";
      continue;
    }
    if (event.type === "child.opened") {
      openName = event.data?.name ?? openName ?? "subagent";
      continue;
    }
    if (event.type === "task.ended") {
      openName = undefined;
      continue;
    }
    if (event.type === "turn.settled" || event.type === "session.ended") {
      openName = undefined;
    }
  }
  return openName ? `Working with ${openName}` : undefined;
}

/**
 * Derive the live status phrase for the thinking indicator.
 * Returns `label: undefined` when the UI should yield to answer content.
 */
export function deriveLiveThinkingState(
  input: DeriveLiveThinkingStateInput,
): LiveThinkingState {
  const {
    events = [],
    parts = [],
    agents,
    statusType,
    waitingLabel = DEFAULT_THINKING_LABEL,
    personWaitLabel,
    answerPhase = false,
  } = input;

  if (statusType === "requires-action") {
    return {
      phase: "person-wait",
      label: personWaitLabel ?? "Needs your approval",
    };
  }

  if (statusType !== "running" && statusType !== undefined) {
    return { phase: "idle", label: undefined };
  }

  if (answerPhase) {
    return { phase: "idle", label: undefined };
  }

  const open = latestOpenInteraction(events);
  if (open || personWaitLabel) {
    if (open?.request?.kind === "sign-in") {
      return { phase: "person-wait", label: personWaitLabel ?? "Sign in to continue" };
    }
    if (open?.request?.kind === "question") {
      return { phase: "person-wait", label: personWaitLabel ?? "Asking questions" };
    }
    return {
      phase: "person-wait",
      label: personWaitLabel ?? "Needs your approval",
    };
  }

  if (hasOpenCompaction(events)) {
    return { phase: "compaction", label: "Summarizing earlier context" };
  }

  if (hasPendingModelRetry(events)) {
    return { phase: "retry", label: "Retrying model" };
  }

  const child = activeChildLabel(agents) ?? latestTaskLabel(events);
  if (child) {
    return { phase: "subagent", label: child };
  }

  const progress = latestCallProgressLabel(events);
  if (progress) {
    return { phase: "tool", label: progress };
  }

  const tool = runningToolLabel(parts);
  if (tool) {
    return { phase: "tool", label: tool };
  }

  const reasoning = streamingReasoningLabel(parts);
  if (reasoning) {
    return { phase: "reasoning", label: reasoning };
  }

  if (!hasVisibleWork(parts)) {
    return {
      phase: "pre-content",
      label: waitingLabel.trim() || DEFAULT_THINKING_LABEL,
    };
  }

  return { phase: "idle", label: undefined };
}

/**
 * Hold an intermediate label for at least `dwellMs` so rapid stream ticks
 * do not thrash the thinking-states swap animation.
 */
export function createThinkingStateDweller({
  dwellMs = THINKING_STATE_DWELL_MS,
  now = () => Date.now(),
}: {
  readonly dwellMs?: number;
  readonly now?: () => number;
} = {}) {
  let held: string | undefined;
  let heldAt = 0;
  let pending: string | undefined;

  return {
    next(label: string | undefined, t = now()): string | undefined {
      if (label === held) {
        pending = undefined;
        return held;
      }
      // Clearing (undefined) is immediate — answer handoff should not wait.
      if (label === undefined) {
        held = undefined;
        pending = undefined;
        heldAt = t;
        return undefined;
      }
      if (held === undefined) {
        held = label;
        heldAt = t;
        pending = undefined;
        return held;
      }
      if (t - heldAt >= dwellMs) {
        held = label;
        heldAt = t;
        pending = undefined;
        return held;
      }
      pending = label;
      return held;
    },
    flush(t = now()): string | undefined {
      if (pending === undefined) return held;
      if (t - heldAt < dwellMs) return held;
      held = pending;
      heldAt = t;
      pending = undefined;
      return held;
    },
    peek(): string | undefined {
      return held;
    },
  };
}

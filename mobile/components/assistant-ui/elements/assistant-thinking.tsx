import { useAuiState } from "@assistant-ui/react-native";
import { useSyncExternalStore } from "react";

import { ThinkingIndicator } from "@/components/assistant-ui/elements/thinking-indicator";
import {
  hasComposerOpenQuestion,
  isTimelineToolCall,
  isTrailingContentPhase,
  splitAssistantBlocks,
  type AssistantMessagePart,
} from "@/components/assistant-ui/elements/session-timeline";
import { DELEGATION_TOOLS } from "@/components/assistant-ui/elements/task-card.aui";
import { useTurnElapsed } from "@/components/assistant-ui/elements/turn-elapsed";
import { useChatConversation } from "@/src/conversation-context";
import { pendingWaitLabel } from "@/src/message-projection";
import {
  getWaitingLabel,
  subscribeWaitingLabel,
} from "../../../../lib/waiting-label";
import {
  statusLabelForTool,
  type ActivityToolPart,
} from "../../../../lib/thread-activity";

function isDelegationToolCall(part: {
  readonly type?: string;
  readonly toolName?: string;
}): boolean {
  return (
    part.type === "tool-call" &&
    !!part.toolName &&
    DELEGATION_TOOLS.has(part.toolName)
  );
}

const STALL_WARNING_S = 45;
const STALL_LABEL = "Still working — the model may be slow or unreachable.";
const ASKING_QUESTIONS_LABEL = "Asking questions";
/** Selector sentinel — must stay a stable primitive for useAuiState. */
const WAITING_PHASE = "waiting";
const ASKING_PHASE = "asking";
const PERSON_WAIT_PHASE = "person-wait";

/**
 * Bottom status for pre-content / uncovered tools / open questions. Hidden
 * while the answer streams (timeline already shows the settled header) and
 * while a trailing timeline owns live activity — except stall warnings during
 * active work, and "Asking questions" while a choice question owns the composer.
 */
export function AssistantThinking() {
  const { waitKind } = useChatConversation();
  const waitingLabel = useSyncExternalStore(
    subscribeWaitingLabel,
    getWaitingLabel,
    getWaitingLabel,
  );
  // useAuiState compares with Object.is — return strings/undefined only.
  const phase = useAuiState((s) => {
    const statusType = s.message.status?.type;
    const parts = s.message.parts as readonly AssistantMessagePart[];

    // Text-only freeform asks use the normal composer — no status chrome.
    if (statusType === "requires-action" && hasComposerOpenQuestion(parts)) {
      return ASKING_PHASE;
    }

    if (statusType !== "running") return undefined;
    // Final (or mid-turn) prose / cards are on screen — no bottom spinner.
    if (isTrailingContentPhase(splitAssistantBlocks(parts))) return undefined;

    const pending = parts.find(
      (part) =>
        part.type === "tool-call" &&
        part.status?.type === "running" &&
        part.toolName !== "todo",
    );
    if (pending?.type === "tool-call") {
      // Trailing timeline segment already shows Working for covered tools.
      if (isTimelineToolCall(pending)) return undefined;
      // Task cards own status for delegated subagents.
      if (isDelegationToolCall(pending)) return undefined;
      // A person-wait on an earlier / child call owns the status line.
      return PERSON_WAIT_PHASE;
    }

    const hasWork = parts.some(
      (part) =>
        part.type === "reasoning" ||
        part.type === "tool-call" ||
        part.type === "file" ||
        part.type === "image" ||
        (part.type === "text" &&
          typeof part.text === "string" &&
          part.text.trim().length > 0),
    );
    return hasWork ? undefined : WAITING_PHASE;
  });

  const runningToolLabel = useAuiState((s) => {
    if (s.message.status?.type !== "running") return undefined;
    const parts = s.message.parts as readonly AssistantMessagePart[];
    if (isTrailingContentPhase(splitAssistantBlocks(parts))) return undefined;
    const pending = parts.find(
      (part) =>
        part.type === "tool-call" &&
        part.status?.type === "running" &&
        part.toolName !== "todo",
    );
    if (
      pending?.type !== "tool-call" ||
      isTimelineToolCall(pending) ||
      isDelegationToolCall(pending)
    ) {
      return undefined;
    }
    return statusLabelForTool(pending as ActivityToolPart, { live: true });
  });

  const personWaitLabel = waitKind ? pendingWaitLabel(waitKind) : null;
  const label =
    phase === ASKING_PHASE
      ? ASKING_QUESTIONS_LABEL
      : phase === PERSON_WAIT_PHASE
        ? personWaitLabel ?? runningToolLabel
        : phase === WAITING_PHASE
          ? waitingLabel
          : phase === undefined && personWaitLabel
            ? personWaitLabel
            : phase;

  const answerPhase = useAuiState((s) => {
    if (s.message.status?.type !== "running") return false;
    const parts = s.message.parts as readonly AssistantMessagePart[];
    return isTrailingContentPhase(splitAssistantBlocks(parts));
  });

  const trailingTimelineLive = useAuiState((s) => {
    if (s.message.status?.type !== "running") return false;
    const parts = s.message.parts as readonly AssistantMessagePart[];
    const blocks = splitAssistantBlocks(parts);
    if (isTrailingContentPhase(blocks)) return false;
    return blocks.length > 0 && blocks[blocks.length - 1]?.kind === "timeline";
  });

  const askingQuestions = phase === ASKING_PHASE || waitKind === "question";
  const parkedOnPerson = personWaitLabel != null;
  const elapsed = useTurnElapsed();
  const seconds = Number.parseInt(elapsed ?? "0", 10);
  const stalled = Number.isFinite(seconds) && seconds > STALL_WARNING_S;

  // Answer text is the status; don't put Working/stall under it.
  if (answerPhase && !parkedOnPerson) return null;
  if (trailingTimelineLive && !stalled && !askingQuestions && !parkedOnPerson) {
    return null;
  }
  if (label === undefined && !stalled) return null;

  return (
    <ThinkingIndicator
      label={
        stalled && !askingQuestions && !parkedOnPerson
          ? STALL_LABEL
          : (label ?? "Thinking…")
      }
      elapsed={askingQuestions || parkedOnPerson ? undefined : elapsed}
    />
  );
}

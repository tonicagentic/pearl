import { useAuiState } from "@assistant-ui/react-native";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import { ThinkingIndicator } from "@/components/assistant-ui/elements/thinking-indicator";
import {
  hasComposerOpenQuestion,
  isTrailingContentPhase,
  splitAssistantBlocks,
  type AssistantMessagePart,
} from "@/components/assistant-ui/elements/session-timeline";
import { useTurnElapsed } from "@/components/assistant-ui/elements/turn-elapsed";
import { useChatConversation } from "@/src/conversation-context";
import { useEveEvents } from "@/src/chat-context";
import { pendingWaitLabel } from "@/src/message-projection";
import {
  getWaitingLabel,
  subscribeWaitingLabel,
} from "../../../../lib/waiting-label";
import {
  createThinkingStateDweller,
  deriveLiveThinkingState,
  type ThinkingMessagePart,
} from "../../../../lib/stream-thinking-state";

const STALL_WARNING_S = 45;
const STALL_LABEL = "Still working — the model may be slow or unreachable.";
const ASKING_QUESTIONS_LABEL = "Asking questions";

/**
 * Bottom status for pre-content / reasoning / tools / subagents. Driven by
 * deriveLiveThinkingState + dwell coalescing. Hidden once answer prose owns
 * the turn (unless parked on the person). Raw reasoning stays in timeline
 * StepRow detail.
 */
export function AssistantThinking() {
  const { waitKind, conversation } = useChatConversation();
  const events = useEveEvents();
  const agents = conversation.agents;
  const waitingLabel = useSyncExternalStore(
    subscribeWaitingLabel,
    getWaitingLabel,
    getWaitingLabel,
  );

  const statusType = useAuiState((s) => s.message.status?.type);
  const parts = useAuiState(
    (s) => s.message.parts as readonly AssistantMessagePart[],
  );

  const askingQuestions =
    (statusType === "requires-action" && hasComposerOpenQuestion(parts)) ||
    waitKind === "question";
  const personWaitLabel = waitKind ? pendingWaitLabel(waitKind) : null;
  const answerPhase = isTrailingContentPhase(splitAssistantBlocks(parts));

  const derived = useMemo(
    () =>
      deriveLiveThinkingState({
        events: events as unknown as Parameters<
          typeof deriveLiveThinkingState
        >[0]["events"],
        parts: parts as readonly ThinkingMessagePart[],
        agents: agents as unknown as Parameters<
          typeof deriveLiveThinkingState
        >[0]["agents"],
        statusType,
        waitingLabel,
        personWaitLabel: askingQuestions
          ? ASKING_QUESTIONS_LABEL
          : personWaitLabel,
        answerPhase: answerPhase && !askingQuestions && !personWaitLabel,
      }),
    [
      agents,
      answerPhase,
      askingQuestions,
      events,
      parts,
      personWaitLabel,
      statusType,
      waitingLabel,
    ],
  );

  const dwellerRef = useRef(createThinkingStateDweller());
  const [label, setLabel] = useState<string | undefined>(derived.label);

  useEffect(() => {
    setLabel(dwellerRef.current.next(derived.label));
    if (derived.label === undefined) return undefined;
    const timer = setInterval(() => {
      setLabel(dwellerRef.current.flush());
    }, 100);
    return () => clearInterval(timer);
  }, [derived.label]);

  const elapsed = useTurnElapsed();
  const seconds = Number.parseInt(elapsed ?? "0", 10);
  const stalled = Number.isFinite(seconds) && seconds > STALL_WARNING_S;
  const parkedOnPerson = personWaitLabel != null || askingQuestions;

  if (answerPhase && !parkedOnPerson && !stalled) return null;
  if (label === undefined && !stalled) return null;

  return (
    <ThinkingIndicator
      label={
        stalled && !parkedOnPerson ? STALL_LABEL : (label ?? "Thinking…")
      }
      elapsed={parkedOnPerson ? undefined : elapsed}
    />
  );
}

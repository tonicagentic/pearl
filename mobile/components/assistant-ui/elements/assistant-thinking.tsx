import { useAuiState } from "@assistant-ui/react-native";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import { ThinkingIndicator } from "@/components/assistant-ui/elements/thinking-indicator";
import {
  hasComposerOpenQuestion,
  isTrailingContentPhase,
  splitAssistantBlocks,
  type AssistantMessagePart,
} from "@/components/assistant-ui/elements/session-timeline";
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
  // Don't clear chrome the instant a text part mounts — wait until at least
  // one finished word (trailing whitespace) or the turn has settled with copy.
  const answerHasPaintedWord = parts.some(
    (part) =>
      part.type === "text" &&
      typeof part.text === "string" &&
      (/\S+\s/.test(part.text) ||
        (statusType !== "running" && part.text.trim().length > 0)),
  );
  const answerOwnsChrome =
    answerPhase && answerHasPaintedWord && !askingQuestions && !personWaitLabel;

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
        answerPhase: answerOwnsChrome,
      }),
    [
      agents,
      answerOwnsChrome,
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

  const parkedOnPerson = personWaitLabel != null || askingQuestions;
  const trailingTimelineLive = useAuiState((s) => {
    if (s.message.status?.type !== "running") return false;
    const msgParts = s.message.parts as readonly AssistantMessagePart[];
    const blocks = splitAssistantBlocks(msgParts);
    if (blocks.length === 0) return false;
    if (blocks[blocks.length - 1]?.kind === "timeline") return true;
    // Content exists but no finished word yet — timeline still owns chrome.
    return !msgParts.some(
      (part) =>
        part.type === "text" &&
        typeof part.text === "string" &&
        /\S+\s/.test(part.text),
    );
  });

  if (answerOwnsChrome && !parkedOnPerson) return null;
  if (trailingTimelineLive && !askingQuestions && !parkedOnPerson) {
    return null;
  }
  if (label === undefined) return null;

  return <ThinkingIndicator label={label} />;
}

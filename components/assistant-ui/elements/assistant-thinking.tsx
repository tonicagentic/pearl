"use client";

import { useAuiState } from "@assistant-ui/react";
import { useEveAgents, useEveEvents } from "@assistant-ui/eve";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ThinkingIndicator } from "@/components/assistant-ui/elements/thinking-indicator";
import {
  getWaitingLabel,
  subscribeWaitingLabel,
} from "@/lib/waiting-label";
import {
  createThinkingStateDweller,
  deriveLiveThinkingState,
  type ThinkingMessagePart,
} from "@/lib/stream-thinking-state";

// In-thread agent status driven by the shared eve stream state machine.
// Stays live across pre-content, reasoning, streaming tool calls, and
// subagent phases — yielding only when reply prose is actively streaming
// or the turn settles. Raw reasoning stays collapsed in SessionTimeline.
// While a subagent row is live, the status line stays quiet (the row owns
// "Waiting for subagent").

function isAnswerPhase(parts: readonly ThinkingMessagePart[]): boolean {
  for (let i = parts.length - 1; i >= 0; i -= 1) {
    const part = parts[i];
    if (!part) continue;
    if (part.type === "tool-call") return false;
    if (part.type === "reasoning") return false;
    if (
      part.type === "text" &&
      typeof part.text === "string" &&
      part.text.trim().length > 0
    ) {
      return true;
    }
    if (part.type === "file" || part.type === "image" || part.type === "data") {
      return true;
    }
  }
  return false;
}

export function AssistantThinking() {
  const waitingLabel = useSyncExternalStore(
    subscribeWaitingLabel,
    getWaitingLabel,
    getWaitingLabel,
  );
  const events = useEveEvents();
  const agents = useEveAgents();
  const statusType = useAuiState((s) => s.message.status?.type);
  const parts = useAuiState(
    (s) => s.message.parts as readonly ThinkingMessagePart[],
  );

  const answerPhase = useMemo(() => isAnswerPhase(parts), [parts]);
  const derived = useMemo(
    () =>
      deriveLiveThinkingState({
        events: events as unknown as Parameters<
          typeof deriveLiveThinkingState
        >[0]["events"],
        parts,
        agents: agents as unknown as Parameters<
          typeof deriveLiveThinkingState
        >[0]["agents"],
        statusType,
        waitingLabel,
        answerPhase,
      }),
    [agents, answerPhase, events, parts, statusType, waitingLabel],
  );

  const dwellerRef = useRef(createThinkingStateDweller());
  const [label, setLabel] = useState<string | undefined>(derived.label);

  useEffect(() => {
    setLabel(dwellerRef.current.next(derived.label));
    if (derived.label === undefined) return undefined;
    const timer = window.setInterval(() => {
      setLabel(dwellerRef.current.flush());
    }, 100);
    return () => window.clearInterval(timer);
  }, [derived.label]);

  if (label === undefined) return null;

  return (
    <ThinkingIndicator label={label} data-testid="assistant-thinking" />
  );
}

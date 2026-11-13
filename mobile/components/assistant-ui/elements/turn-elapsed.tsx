import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { useAuiState } from "@assistant-ui/react-native";

import {
  isTrailingContentPhase,
  splitAssistantBlocks,
  type AssistantMessagePart,
} from "@/src/assistant-blocks";
import { useEveEvents } from "@/src/chat-context";
import { turnEventSpan } from "@/src/turn-duration";
import { TimelineDurationEventsContext } from "./timeline-duration-events";
import { useElapsedLabel } from "./use-elapsed-label";

const TurnElapsedContext = createContext<string | undefined>(undefined);

/**
 * One elapsed clock for Thinking + SessionTimeline on the same assistant
 * message. Anchors to the first turn-scoped event when available; pauses
 * across requires-action and while the final answer streams so “Worked for”
 * freezes when prose starts.
 */
export function TurnElapsedProvider({ children }: { readonly children: ReactNode }) {
  const overrideEvents = useContext(TimelineDurationEventsContext);
  const liveEvents = useEveEvents();
  const events = overrideEvents ?? liveEvents;
  const statusType = useAuiState((s) => s.message.status?.type);
  const turnId = useAuiState(
    (s) => s.message.metadata?.custom?.turnId as string | undefined,
  );
  const answerPhase = useAuiState((s) => {
    const parts = s.message.parts as readonly AssistantMessagePart[];
    return isTrailingContentPhase(splitAssistantBlocks(parts));
  });

  const running = statusType === "running";
  const awaitingInput = statusType === "requires-action";
  // Keep the provider active while answering so the frozen label stays available
  // for “Worked for”, but pause the ticker once prose (or a card) is trailing.
  const active = running || awaitingInput;
  const paused = awaitingInput || (running && answerPhase);

  const sinceMs = useMemo(
    () => turnEventSpan(events, turnId)?.startMs ?? null,
    [events, turnId],
  );

  const elapsed = useElapsedLabel(active, { paused, sinceMs });

  return (
    <TurnElapsedContext.Provider value={active ? elapsed : undefined}>
      {children}
    </TurnElapsedContext.Provider>
  );
}

export function useTurnElapsed(): string | undefined {
  return useContext(TurnElapsedContext);
}

import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { useAuiState } from "@assistant-ui/react-native";

import { useEveEvents } from "@/src/chat-context";
import { turnEventSpan } from "@/src/turn-duration";
import { TimelineDurationEventsContext } from "./timeline-duration-events";
import { useElapsedLabel } from "./use-elapsed-label";

const TurnElapsedContext = createContext<string | undefined>(undefined);

/**
 * One elapsed clock for Thinking + SessionTimeline on the same assistant
 * message. Anchors to the first turn-scoped event when available; pauses
 * across requires-action instead of resetting to 0s.
 */
export function TurnElapsedProvider({ children }: { readonly children: ReactNode }) {
  const overrideEvents = useContext(TimelineDurationEventsContext);
  const liveEvents = useEveEvents();
  const events = overrideEvents ?? liveEvents;
  const statusType = useAuiState((s) => s.message.status?.type);
  const turnId = useAuiState(
    (s) => s.message.metadata?.custom?.turnId as string | undefined,
  );

  const running = statusType === "running";
  const paused = statusType === "requires-action";
  const active = running || paused;

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

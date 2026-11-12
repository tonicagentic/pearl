import { createContext, type ReactNode } from "react";

/**
 * Dev/sample override for Worked-for duration. When set, SessionTimeline and
 * TurnElapsed read these instead of the live chat event log so fixtures never
 * persist.
 */
export const TimelineDurationEventsContext = createContext<
  readonly unknown[] | null
>(null);

export function TimelineDurationEventsProvider({
  events,
  children,
}: {
  readonly events: readonly unknown[];
  readonly children: ReactNode;
}) {
  return (
    <TimelineDurationEventsContext.Provider value={events}>
      {children}
    </TimelineDurationEventsContext.Provider>
  );
}

import type { MessageStreamEvent } from "eve/client";

export type AuthorizationEvent = Extract<
  MessageStreamEvent,
  { type: "authorization.required" | "authorization.completed" }
>;

/** Show only a live authorization attempt from the current turn. A failed or
 * completed session must not leave the composer permanently disabled. */
export function latestAuthorization(events: readonly MessageStreamEvent[]): AuthorizationEvent | null {
  for (let index = events.length - 1; index >= 0; index--) {
    const event = events[index];
    if (event.type === "session.failed" || event.type === "session.completed") return null;
    if (event.type === "authorization.required" || event.type === "authorization.completed") return event;
    if (event.type === "turn.started") return null;
  }
  return null;
}

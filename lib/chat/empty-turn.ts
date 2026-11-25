/** Stream events carry at least a `type` for turn lifecycle checks. */
export type TurnLifecycleEvent = { readonly type: string };

/** Eve messages carry at least a `role` for trailing-turn checks. */
export type TurnLifecycleMessage = { readonly role: string };

/**
 * True when the latest turn finished on the server but never published an
 * assistant message — the client should stop sticky "Planning next moves".
 */
export function turnEndedWithoutAssistant(
  events: readonly TurnLifecycleEvent[],
  messages: readonly TurnLifecycleMessage[],
  isBusy: boolean,
): boolean {
  if (isBusy) return false;
  const last = messages[messages.length - 1];
  if (!last || last.role !== "user") return false;
  const started = events.some((event) => event.type === "turn.started");
  const settled = events.some((event) => event.type === "turn.settled");
  return started && settled;
}
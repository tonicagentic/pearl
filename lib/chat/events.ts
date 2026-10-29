import type { MessageStreamEvent } from "eve/client";

export function isChatTurnSettledEvent(event: MessageStreamEvent) {
  return (
    event.type === "authorization.required" ||
    event.type === "session.completed" ||
    event.type === "session.failed" ||
    event.type === "session.waiting"
  );
}

function pendingUserInputState(events: readonly MessageStreamEvent[]): {
  pendingInput: Set<string>;
  pendingAuth: Set<string>;
} {
  const pendingInput = new Set<string>();
  const pendingAuth = new Set<string>();

  for (const event of events) {
    if (event.type === "input.requested") {
      for (const request of event.data.requests ?? []) {
        if (request.requestId) pendingInput.add(request.requestId);
      }
      continue;
    }

    if (event.type === "input.resolved") {
      for (const resolution of event.data.resolutions ?? []) {
        if (resolution.requestId) pendingInput.delete(resolution.requestId);
      }
      continue;
    }

    if (event.type === "authorization.required") {
      const key = event.data.attemptId ?? event.data.name;
      if (key) pendingAuth.add(key);
      continue;
    }

    if (event.type === "authorization.completed") {
      const key = event.data.attemptId ?? event.data.name;
      if (key) pendingAuth.delete(key);
      continue;
    }

    if (event.type === "turn.cancelled" || event.type === "turn.failed") {
      pendingInput.clear();
      pendingAuth.clear();
    }
  }

  return { pendingInput, pendingAuth };
}

/**
 * True when the chat is parked on the user: an unresolved tool-approval /
 * ask_question (`input.requested`) or an open authorization challenge.
 * Matches the composer WaitingActionCard / sidebar "needs you" signal so
 * history rows stay in sync without reopening the chat.
 */
export function chatNeedsUserInput(
  events: readonly MessageStreamEvent[],
): boolean {
  const { pendingInput, pendingAuth } = pendingUserInputState(events);
  return pendingInput.size > 0 || pendingAuth.size > 0;
}

/**
 * True only for an open connection/authorization challenge. Used by the
 * composer text-only WaitingActionCard so a stale `input.requested` (tool
 * already cancelled in the thread) does not leave a buttonless "paused"
 * banner after deny/cancel.
 */
export function chatNeedsAuthorization(
  events: readonly MessageStreamEvent[],
): boolean {
  return pendingUserInputState(events).pendingAuth.size > 0;
}

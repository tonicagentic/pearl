import type { SessionStreamEvent } from "eve/client";

export function isChatTurnSettledEvent(event: SessionStreamEvent) {
  return (
    event.type === "turn.paused" ||
    event.type === "turn.settled" ||
    event.type === "session.ended"
  );
}

function pendingUserInputState(events: readonly SessionStreamEvent[]): {
  pendingInput: Set<string>;
  pendingAuth: Set<string>;
} {
  const pendingInput = new Set<string>();
  const pendingAuth = new Set<string>();

  for (const event of events) {
    if (event.type === "interaction.opened") {
      const { interactionId, request } = event.data;
      if (request.kind === "sign-in") {
        pendingAuth.add(interactionId);
      } else {
        pendingInput.add(interactionId);
      }
      continue;
    }

    if (event.type === "interaction.settled") {
      pendingInput.delete(event.data.interactionId);
      pendingAuth.delete(event.data.interactionId);
      continue;
    }

    if (event.type === "turn.settled" || event.type === "session.ended") {
      pendingInput.clear();
      pendingAuth.clear();
    }
  }

  return { pendingInput, pendingAuth };
}

/**
 * True when the chat is parked on the user: an unresolved tool approval,
 * question, or budget prompt, or an open sign-in challenge. Matches the
 * composer WaitingActionCard / sidebar "needs you" signal so history rows
 * stay in sync without reopening the chat.
 */
export function chatNeedsUserInput(
  events: readonly SessionStreamEvent[],
): boolean {
  const { pendingInput, pendingAuth } = pendingUserInputState(events);
  return pendingInput.size > 0 || pendingAuth.size > 0;
}

/**
 * True only for an open sign-in challenge. Used by the composer text-only
 * WaitingActionCard so a stale approval (tool already cancelled in the
 * thread) does not leave a buttonless "paused" banner after deny/cancel.
 */
export function chatNeedsAuthorization(
  events: readonly SessionStreamEvent[],
): boolean {
  return pendingUserInputState(events).pendingAuth.size > 0;
}

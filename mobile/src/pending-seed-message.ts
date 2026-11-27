/**
 * One-shot first message for a freshly opened chat (e.g. Goals →
 * “I want to set a new goal”). Set before navigating to Pearl; the empty
 * composer consumes and clears it.
 */

let pendingSeedMessage: string | null = null;
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

/** Queue a message to auto-send on the next empty composer. */
export function setPendingSeedMessage(text: string): void {
  const trimmed = text.trim();
  pendingSeedMessage = trimmed.length > 0 ? trimmed : null;
  notify();
}

/** Read without clearing (for subscribe snapshots). */
export function getPendingSeedMessage(): string | null {
  return pendingSeedMessage;
}

/** Take and clear the pending seed, or null if none. */
export function takePendingSeedMessage(): string | null {
  const next = pendingSeedMessage;
  pendingSeedMessage = null;
  if (next) notify();
  return next;
}

export function subscribePendingSeedMessage(
  listener: () => void,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Product copy for Goals create → Pearl walkthrough. */
export const SET_NEW_GOAL_MESSAGE = "I want to set a new goal";

export function setNewGoalSeedMessage(area?: string): void {
  const trimmed = area?.trim();
  if (trimmed) {
    setPendingSeedMessage(`I want to set a new ${trimmed} goal`);
    return;
  }
  setPendingSeedMessage(SET_NEW_GOAL_MESSAGE);
}

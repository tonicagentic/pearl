/**
 * Ephemeral pre-content waiting label for the current send.
 * Set at send time from the local heuristic; cleared when the turn settles.
 * Default matches Cursor's opaque agent wait status.
 */

import { PLANNING_NEXT_MOVES_LABEL } from "./stream-thinking-state.ts";

let label = PLANNING_NEXT_MOVES_LABEL;
const listeners = new Set<() => void>();

export function getWaitingLabel(): string {
  return label;
}

export function setWaitingLabel(next: string): void {
  if (!next.trim() || next === label) return;
  label = next;
  for (const listener of listeners) listener();
}

export function resetWaitingLabel(): void {
  if (label === PLANNING_NEXT_MOVES_LABEL) return;
  label = PLANNING_NEXT_MOVES_LABEL;
  for (const listener of listeners) listener();
}

export function subscribeWaitingLabel(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Ephemeral pre-content waiting label for the current send.
 * Set at send time from the local heuristic; cleared when the turn settles.
 */

let label = "Thinking";
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
  if (label === "Thinking") return;
  label = "Thinking";
  for (const listener of listeners) listener();
}

export function subscribeWaitingLabel(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

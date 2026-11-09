"use client";

// Client store for Agent vs Plan mode, mirroring the model picker store.
// prepareSend reads this and attaches eveAgentMode on clientContext.

export type AgentMode = "agent" | "plan";

let selectedMode: AgentMode = "agent";
const listeners = new Set<() => void>();

export function getAgentMode(): AgentMode {
  return selectedMode;
}

export function setAgentMode(mode: AgentMode): void {
  if (mode !== "agent" && mode !== "plan") return;
  if (mode === selectedMode) return;
  selectedMode = mode;
  for (const listener of listeners) listener();
}

export function subscribeAgentMode(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

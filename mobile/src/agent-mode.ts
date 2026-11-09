// Client store for Agent vs Plan mode (mobile mirror of app/_components/agent-mode.ts).
// Send paths stamp eveAgentMode on clientContext from this store.

import type { AgentMode } from "../../lib/agent-mode-context";

export type { AgentMode };

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

// Composer connected-agent selection for the web chat.
// null = Pearl; otherwise a connected_agent id owned by the signed-in user.
// The value rides each send as clientContext.eveRemoteAgentId.

import type { ConnectedAgentSummary } from "@/lib/connected-agents/types";

let selectedId: string | null = null;
let agents: readonly ConnectedAgentSummary[] = [];
const listeners = new Set<() => void>();
const agentListeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

function notifyAgents() {
  for (const listener of agentListeners) listener();
}

export function getRemoteAgentSelection(): string | null {
  return selectedId;
}

export function setRemoteAgentSelection(id: string | null): void {
  const next = id?.trim() || null;
  if (selectedId === next) return;
  selectedId = next;
  notify();
}

export function subscribeRemoteAgentSelection(
  listener: () => void,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getConnectedAgentsCache(): readonly ConnectedAgentSummary[] {
  return agents;
}

export function setConnectedAgentsCache(
  next: readonly ConnectedAgentSummary[],
): void {
  agents = next;
  if (selectedId && !next.some((agent) => agent.id === selectedId)) {
    selectedId = null;
    notify();
  }
  notifyAgents();
}

export function subscribeConnectedAgentsCache(
  listener: () => void,
): () => void {
  agentListeners.add(listener);
  return () => {
    agentListeners.delete(listener);
  };
}

export function remoteAgentLabel(
  id: string | null,
  list: readonly ConnectedAgentSummary[] = agents,
): string {
  if (!id) return "Pearl";
  return list.find((agent) => agent.id === id)?.label ?? "Connected agent";
}

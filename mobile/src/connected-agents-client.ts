import type { ConnectedAgentSummary } from "../../lib/connected-agents/types";
import { AGENT_URL, getAuthCookie } from "./eve-transport";
import { sessionInvalid } from "./session-store";

export type { ConnectedAgentSummary };

function authHeaders(): Record<string, string> {
  const credential = getAuthCookie();
  return {
    "content-type": "application/json",
    ...(credential ? { authorization: `Bearer ${credential}` } : {}),
  };
}

async function parseError(response: Response, fallback: string): Promise<never> {
  if (response.status === 401) {
    sessionInvalid();
  }
  let message = `${fallback} (${response.status}).`;
  try {
    const data = (await response.json()) as { error?: string };
    if (typeof data.error === "string" && data.error.trim()) {
      message = data.error.trim();
    }
  } catch {
    // Keep status fallback.
  }
  throw new Error(message);
}

export async function listConnectedAgents(): Promise<{
  agents: ConnectedAgentSummary[];
  available: boolean;
}> {
  const response = await fetch(`${AGENT_URL}/api/connected-agents`, {
    headers: authHeaders(),
    cache: "no-store",
  });
  if (!response.ok) {
    await parseError(response, "Could not load connected agents");
  }
  return (await response.json()) as {
    agents: ConnectedAgentSummary[];
    available: boolean;
  };
}

export async function createConnectedAgent(params: {
  readonly label: string;
  readonly url: string;
  readonly token: string;
}): Promise<{
  agent: ConnectedAgentSummary;
  agents: ConnectedAgentSummary[];
}> {
  const response = await fetch(`${AGENT_URL}/api/connected-agents`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(params),
  });
  if (!response.ok) {
    await parseError(response, "Could not connect agent");
  }
  return (await response.json()) as {
    agent: ConnectedAgentSummary;
    agents: ConnectedAgentSummary[];
  };
}

export async function updateConnectedAgent(
  agentId: string,
  params: {
    readonly label?: string;
    readonly url?: string;
    readonly token?: string;
  },
): Promise<{
  agent: ConnectedAgentSummary;
  agents: ConnectedAgentSummary[];
}> {
  const response = await fetch(
    `${AGENT_URL}/api/connected-agents/${encodeURIComponent(agentId)}`,
    {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify(params),
    },
  );
  if (!response.ok) {
    await parseError(response, "Could not update agent");
  }
  return (await response.json()) as {
    agent: ConnectedAgentSummary;
    agents: ConnectedAgentSummary[];
  };
}

export async function deleteConnectedAgent(
  agentId: string,
): Promise<ConnectedAgentSummary[]> {
  const response = await fetch(
    `${AGENT_URL}/api/connected-agents/${encodeURIComponent(agentId)}`,
    {
      method: "DELETE",
      headers: authHeaders(),
    },
  );
  if (!response.ok) {
    await parseError(response, "Could not remove agent");
  }
  const data = (await response.json()) as { agents: ConnectedAgentSummary[] };
  return data.agents;
}

export async function setChatRemoteAgent(
  chatId: string,
  remoteAgentId: string | null,
): Promise<void> {
  const response = await fetch(
    `${AGENT_URL}/api/chats/${encodeURIComponent(chatId)}`,
    {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ remoteAgentId }),
    },
  );
  if (!response.ok) {
    await parseError(response, "Could not set chat agent");
  }
}

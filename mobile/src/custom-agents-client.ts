// Custom agents client: hits /api/custom-agents with the better-auth session.

import { AGENT_URL, getAuthCookie } from "./eve-transport";
import { sessionInvalid } from "./session-store";

export type CustomAgentDto = {
  readonly id: string;
  readonly name: string;
  readonly instructions: string;
  readonly accent: string;
  readonly chatId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

function authHeaders(): Record<string, string> {
  const credential = getAuthCookie();

  return {
    "content-type": "application/json",
    ...(credential ? { authorization: `Bearer ${credential}` } : {}),
  };
}

async function readError(response: Response): Promise<string> {
  const body = (await response.json().catch(() => ({}))) as {
    error?: string;
  };
  return body.error ?? `Request failed (${response.status}).`;
}

function handleAuth(response: Response): void {
  if (response.status === 401) {
    sessionInvalid();
  }
}

export async function fetchCustomAgents(): Promise<readonly CustomAgentDto[]> {
  const response = await fetch(`${AGENT_URL}/api/custom-agents`, {
    headers: authHeaders(),
  });
  handleAuth(response);
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  const body = (await response.json()) as {
    agents?: readonly CustomAgentDto[];
  };
  return body.agents ?? [];
}

export async function createCustomAgentRequest(input: {
  readonly name: string;
  readonly instructions?: string;
  readonly accent?: string;
}): Promise<CustomAgentDto> {
  const response = await fetch(`${AGENT_URL}/api/custom-agents`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(input),
  });
  handleAuth(response);
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  const body = (await response.json()) as { agent: CustomAgentDto };
  return body.agent;
}

export async function updateCustomAgentRequest(
  agentId: string,
  input: {
    readonly name?: string;
    readonly instructions?: string;
    readonly accent?: string;
  },
): Promise<CustomAgentDto> {
  const response = await fetch(
    `${AGENT_URL}/api/custom-agents/${encodeURIComponent(agentId)}`,
    {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify(input),
    },
  );
  handleAuth(response);
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  const body = (await response.json()) as { agent: CustomAgentDto };
  return body.agent;
}

export async function deleteCustomAgentRequest(
  agentId: string,
): Promise<void> {
  const response = await fetch(
    `${AGENT_URL}/api/custom-agents/${encodeURIComponent(agentId)}`,
    {
      method: "DELETE",
      headers: authHeaders(),
    },
  );
  handleAuth(response);
  if (!response.ok) {
    throw new Error(await readError(response));
  }
}

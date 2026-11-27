// Custom agents client: hits /api/custom-agents with the better-auth session.

import { AGENT_URL, getAuthCookie } from "./eve-transport";
import { sessionInvalid } from "./session-store";

import type {
  AgentMarkBrows,
  AgentMarkGaze,
  AgentMarkShape,
  AgentMarkTalk,
} from "../../lib/custom-agents/mark";

export type CustomAgentDto = {
  readonly id: string;
  readonly name: string;
  readonly instructions: string;
  readonly accent: string;
  readonly markShape: AgentMarkShape;
  readonly markTalk: AgentMarkTalk;
  readonly markBrows: AgentMarkBrows;
  readonly markGaze: AgentMarkGaze;
  readonly projectId: string;
  readonly projectName: string | null;
  readonly role: "manager" | "member";
  readonly chatId: string;
  /** Current title of the agent's durable chat (list preview). */
  readonly chatTitle: string;
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

export async function fetchCustomAgents(options?: {
  readonly projectId?: string;
}): Promise<readonly CustomAgentDto[]> {
  const params = new URLSearchParams();
  if (options?.projectId) params.set("projectId", options.projectId);
  const qs = params.toString();
  const response = await fetch(
    `${AGENT_URL}/api/custom-agents${qs ? `?${qs}` : ""}`,
    { headers: authHeaders() },
  );
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
  readonly projectId: string;
  readonly name: string;
  readonly instructions?: string;
  readonly accent?: string;
  readonly markShape?: AgentMarkShape;
  readonly markTalk?: AgentMarkTalk;
  readonly markBrows?: AgentMarkBrows;
  readonly markGaze?: AgentMarkGaze;
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
    readonly markShape?: AgentMarkShape;
    readonly markTalk?: AgentMarkTalk;
    readonly markBrows?: AgentMarkBrows;
    readonly markGaze?: AgentMarkGaze;
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

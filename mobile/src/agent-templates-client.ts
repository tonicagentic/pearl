import { AGENT_URL, getAuthCookie } from "./eve-transport";
import { sessionInvalid } from "./session-store";

import type {
  AgentTemplateDetail,
  AgentTemplateSummary,
  CustomAgentConfigBundle,
  CustomAgentIntegrationView,
  CustomAgentMemoryView,
  CustomAgentRoutineView,
  CustomAgentSkillView,
} from "../../lib/custom-agents/template-types";
import type { CustomAgentDto } from "./custom-agents-client";

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
  if (response.status === 401) sessionInvalid();
}

export async function fetchAgentTemplates(options?: {
  readonly projectId?: string;
}): Promise<readonly AgentTemplateSummary[]> {
  const params = new URLSearchParams();
  if (options?.projectId) params.set("projectId", options.projectId);
  const qs = params.toString();
  const response = await fetch(
    `${AGENT_URL}/api/agent-templates${qs ? `?${qs}` : ""}`,
    { headers: authHeaders() },
  );
  handleAuth(response);
  if (!response.ok) throw new Error(await readError(response));
  const body = (await response.json()) as {
    templates?: readonly AgentTemplateSummary[];
  };
  return body.templates ?? [];
}

export async function fetchAgentTemplate(
  slug: string,
  options?: { readonly projectId?: string },
): Promise<AgentTemplateDetail> {
  const params = new URLSearchParams();
  if (options?.projectId) params.set("projectId", options.projectId);
  const qs = params.toString();
  const response = await fetch(
    `${AGENT_URL}/api/agent-templates/${encodeURIComponent(slug)}${qs ? `?${qs}` : ""}`,
    { headers: authHeaders() },
  );
  handleAuth(response);
  if (!response.ok) throw new Error(await readError(response));
  const body = (await response.json()) as { template: AgentTemplateDetail };
  return body.template;
}

export async function addAgentFromTemplateRequest(
  slug: string,
  projectId: string,
): Promise<CustomAgentDto> {
  const response = await fetch(
    `${AGENT_URL}/api/agent-templates/${encodeURIComponent(slug)}/add`,
    {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ projectId }),
    },
  );
  handleAuth(response);
  if (!response.ok) throw new Error(await readError(response));
  const body = (await response.json()) as { agent: CustomAgentDto };
  return body.agent;
}

export async function fetchCustomAgentConfig(
  agentId: string,
): Promise<CustomAgentConfigBundle> {
  const response = await fetch(
    `${AGENT_URL}/api/custom-agents/${encodeURIComponent(agentId)}/config`,
    { headers: authHeaders() },
  );
  handleAuth(response);
  if (!response.ok) throw new Error(await readError(response));
  const body = (await response.json()) as { config: CustomAgentConfigBundle };
  return body.config;
}

export async function addCustomAgentMemoryRequest(
  agentId: string,
  text: string,
): Promise<CustomAgentMemoryView> {
  const response = await fetch(
    `${AGENT_URL}/api/custom-agents/${encodeURIComponent(agentId)}/memories`,
    {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ text }),
    },
  );
  handleAuth(response);
  if (!response.ok) throw new Error(await readError(response));
  const body = (await response.json()) as { memory: CustomAgentMemoryView };
  return body.memory;
}

export async function deleteCustomAgentMemoryRequest(
  agentId: string,
  memoryId: string,
): Promise<void> {
  const response = await fetch(
    `${AGENT_URL}/api/custom-agents/${encodeURIComponent(agentId)}/memories/${encodeURIComponent(memoryId)}`,
    { method: "DELETE", headers: authHeaders() },
  );
  handleAuth(response);
  if (!response.ok) throw new Error(await readError(response));
}

export async function upsertCustomAgentSkillRequest(
  agentId: string,
  input: {
    readonly id?: string;
    readonly slug: string;
    readonly title: string;
    readonly description: string;
    readonly markdown: string;
    readonly enabled?: boolean;
  },
): Promise<CustomAgentSkillView> {
  const response = await fetch(
    `${AGENT_URL}/api/custom-agents/${encodeURIComponent(agentId)}/skills`,
    {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(input),
    },
  );
  handleAuth(response);
  if (!response.ok) throw new Error(await readError(response));
  const body = (await response.json()) as { skill: CustomAgentSkillView };
  return body.skill;
}

export async function deleteCustomAgentSkillRequest(
  agentId: string,
  skillId: string,
): Promise<void> {
  const response = await fetch(
    `${AGENT_URL}/api/custom-agents/${encodeURIComponent(agentId)}/skills/${encodeURIComponent(skillId)}`,
    { method: "DELETE", headers: authHeaders() },
  );
  handleAuth(response);
  if (!response.ok) throw new Error(await readError(response));
}

export async function upsertCustomAgentRoutineRequest(
  agentId: string,
  input: {
    readonly id?: string;
    readonly name: string;
    readonly cron: string;
    readonly timezone?: string;
    readonly prompt: string;
    readonly enabled?: boolean;
  },
): Promise<CustomAgentRoutineView> {
  const response = await fetch(
    `${AGENT_URL}/api/custom-agents/${encodeURIComponent(agentId)}/routines`,
    {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(input),
    },
  );
  handleAuth(response);
  if (!response.ok) throw new Error(await readError(response));
  const body = (await response.json()) as { routine: CustomAgentRoutineView };
  return body.routine;
}

export async function deleteCustomAgentRoutineRequest(
  agentId: string,
  routineId: string,
): Promise<void> {
  const response = await fetch(
    `${AGENT_URL}/api/custom-agents/${encodeURIComponent(agentId)}/routines/${encodeURIComponent(routineId)}`,
    { method: "DELETE", headers: authHeaders() },
  );
  handleAuth(response);
  if (!response.ok) throw new Error(await readError(response));
}

export async function setCustomAgentIntegrationsRequest(
  agentId: string,
  connectionIds: readonly string[],
): Promise<readonly CustomAgentIntegrationView[]> {
  const response = await fetch(
    `${AGENT_URL}/api/custom-agents/${encodeURIComponent(agentId)}/config`,
    {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify({ connectionIds }),
    },
  );
  handleAuth(response);
  if (!response.ok) throw new Error(await readError(response));
  const body = (await response.json()) as {
    integrations: readonly CustomAgentIntegrationView[];
  };
  return body.integrations;
}

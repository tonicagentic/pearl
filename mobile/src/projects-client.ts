// Projects + plans client: hits /api/projects with the better-auth session
// credential, same pattern as issues/apps.

import { AGENT_URL, getAuthCookie } from "./eve-transport";
import { sessionInvalid } from "./session-store";

export type ProjectDto = {
  readonly id: string;
  readonly name: string;
  readonly instructions: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type PlanSummaryDto = {
  readonly id: string;
  readonly title: string;
  readonly slug: string;
  readonly updatedAt: string;
};

export type PlanDto = {
  readonly id: string;
  readonly projectId: string;
  readonly title: string;
  readonly slug: string;
  readonly markdown: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type ProjectChatDto = {
  readonly id: string;
  readonly title: string;
  readonly updatedAt: string;
};

export type ProjectWorkspaceDto = {
  readonly project: ProjectDto;
  readonly plans: readonly PlanSummaryDto[];
  readonly chats: readonly ProjectChatDto[];
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

export async function fetchProjects(): Promise<readonly ProjectDto[]> {
  const response = await fetch(`${AGENT_URL}/api/projects`, {
    headers: authHeaders(),
  });

  if (!response.ok) {
    handleAuth(response);
    throw new Error(await readError(response));
  }

  const data = (await response.json()) as { projects: ProjectDto[] };
  return data.projects;
}

export async function createProjectRequest(input: {
  readonly name: string;
  readonly instructions?: string;
}): Promise<ProjectDto> {
  const response = await fetch(`${AGENT_URL}/api/projects`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    handleAuth(response);
    throw new Error(await readError(response));
  }

  const data = (await response.json()) as { project: ProjectDto };
  return data.project;
}

export async function fetchProjectWorkspace(
  id: string,
): Promise<ProjectWorkspaceDto> {
  const response = await fetch(
    `${AGENT_URL}/api/projects/${encodeURIComponent(id)}`,
    { headers: authHeaders() },
  );

  if (!response.ok) {
    handleAuth(response);
    throw new Error(await readError(response));
  }

  return (await response.json()) as ProjectWorkspaceDto;
}

export async function updateProjectRequest(
  id: string,
  input: { readonly name?: string; readonly instructions?: string },
): Promise<ProjectDto> {
  const response = await fetch(
    `${AGENT_URL}/api/projects/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify(input),
    },
  );

  if (!response.ok) {
    handleAuth(response);
    throw new Error(await readError(response));
  }

  const data = (await response.json()) as { project: ProjectDto };
  return data.project;
}

export async function deleteProjectRequest(id: string): Promise<void> {
  const response = await fetch(
    `${AGENT_URL}/api/projects/${encodeURIComponent(id)}`,
    {
      method: "DELETE",
      headers: authHeaders(),
    },
  );

  if (!response.ok) {
    handleAuth(response);
    throw new Error(await readError(response));
  }
}

export async function createPlanRequest(
  projectId: string,
  input: { readonly title: string; readonly markdown?: string },
): Promise<PlanDto> {
  const response = await fetch(
    `${AGENT_URL}/api/projects/${encodeURIComponent(projectId)}/plans`,
    {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(input),
    },
  );

  if (!response.ok) {
    handleAuth(response);
    throw new Error(await readError(response));
  }

  const data = (await response.json()) as { plan: PlanDto };
  return data.plan;
}

export async function fetchPlan(
  projectId: string,
  planId: string,
): Promise<PlanDto> {
  const response = await fetch(
    `${AGENT_URL}/api/projects/${encodeURIComponent(projectId)}/plans/${encodeURIComponent(planId)}`,
    { headers: authHeaders() },
  );

  if (!response.ok) {
    handleAuth(response);
    throw new Error(await readError(response));
  }

  const data = (await response.json()) as { plan: PlanDto };
  return data.plan;
}

export async function updatePlanRequest(
  projectId: string,
  planId: string,
  input: { readonly title?: string; readonly markdown?: string },
): Promise<PlanDto> {
  const response = await fetch(
    `${AGENT_URL}/api/projects/${encodeURIComponent(projectId)}/plans/${encodeURIComponent(planId)}`,
    {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify(input),
    },
  );

  if (!response.ok) {
    handleAuth(response);
    throw new Error(await readError(response));
  }

  const data = (await response.json()) as { plan: PlanDto };
  return data.plan;
}

export async function deletePlanRequest(
  projectId: string,
  planId: string,
): Promise<void> {
  const response = await fetch(
    `${AGENT_URL}/api/projects/${encodeURIComponent(projectId)}/plans/${encodeURIComponent(planId)}`,
    {
      method: "DELETE",
      headers: authHeaders(),
    },
  );

  if (!response.ok) {
    handleAuth(response);
    throw new Error(await readError(response));
  }
}

export async function carryOutPlanRequest(
  projectId: string,
  planId: string,
): Promise<{ readonly chatId: string; readonly projectId: string }> {
  const response = await fetch(
    `${AGENT_URL}/api/projects/${encodeURIComponent(projectId)}/plans/${encodeURIComponent(planId)}`,
    {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ op: "carryOut" }),
    },
  );

  if (!response.ok) {
    handleAuth(response);
    throw new Error(await readError(response));
  }

  return (await response.json()) as {
    chatId: string;
    projectId: string;
  };
}

// Projects + plans client: hits /api/projects with the better-auth session
// credential, same pattern as issues/apps.

import { AGENT_URL, getAuthCookie } from "./eve-transport";
import { sessionInvalid } from "./session-store";

export type ProjectStatus =
  | "backlog"
  | "planned"
  | "in_progress"
  | "completed"
  | "canceled";

export type ProjectPriority =
  | "none"
  | "urgent"
  | "high"
  | "medium"
  | "low";

export type ProjectDto = {
  readonly id: string;
  readonly name: string;
  readonly instructions: string;
  readonly status: ProjectStatus;
  readonly priority: ProjectPriority;
  readonly startDate: string | null;
  readonly targetDate: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type ProjectLinkDto = {
  readonly id: string;
  readonly projectId: string;
  readonly title: string;
  readonly url: string;
  readonly sortOrder: number;
  readonly createdAt: string;
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

export type ProjectPinDto = {
  readonly id: string;
  readonly userId: string;
  readonly owner: string;
  readonly name: string;
  readonly fullName: string;
  readonly vercelProjectId: string | null;
  readonly vercelTeamId: string | null;
  readonly expoProjectId: string | null;
  readonly expoUpdateChannel: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type ProjectIssueDto = {
  readonly id: string;
  readonly title: string;
  readonly description: string | null;
  readonly status: "open" | "resolved";
  readonly dueDate: string | null;
  readonly reviewDate: string | null;
  readonly createdAt: string;
  readonly resolvedAt: string | null;
  readonly areaId: string;
  readonly areaName: string;
  readonly projectId: string | null;
  readonly state: "active" | "dormant" | "resolved";
  readonly dueSoon?: boolean;
};

export type ProjectArtifactDto = {
  readonly id: string;
  readonly projectId: string;
  readonly pathname: string;
  readonly title: string;
  readonly sortOrder: number;
  readonly createdAt: string;
};

export type ProjectGoalDto = {
  readonly id: string;
  readonly projectId: string | null;
  readonly projectName?: string | null;
  readonly title: string;
  readonly status: "active" | "done";
  readonly targetDate: string | null;
  readonly notes: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type ProjectNoteSummaryDto = {
  readonly id: string;
  readonly projectId: string | null;
  readonly projectName?: string | null;
  readonly title: string;
  readonly updatedAt: string;
};

export type ProjectAgentDto = {
  readonly id: string;
  readonly name: string;
  readonly instructions: string;
  readonly accent: string;
  readonly markShape: string;
  readonly markTalk: string;
  readonly markBrows: string;
  readonly markGaze: string;
  readonly projectId: string;
  readonly projectName: string | null;
  readonly role: "manager" | "member";
  readonly chatId: string;
  readonly chatTitle: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type ProjectWorkspaceDto = {
  readonly project: ProjectDto;
  readonly plans: readonly PlanSummaryDto[];
  readonly agents: readonly ProjectAgentDto[];
  readonly chats: readonly ProjectChatDto[];
  readonly pins: readonly ProjectPinDto[];
  readonly issues: readonly ProjectIssueDto[];
  readonly artifacts: readonly ProjectArtifactDto[];
  readonly goals: readonly ProjectGoalDto[];
  readonly notes: readonly ProjectNoteSummaryDto[];
  readonly links: readonly ProjectLinkDto[];
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

  const data = (await response.json()) as ProjectWorkspaceDto;
  return {
    ...data,
    agents: data.agents ?? [],
    pins: data.pins ?? [],
    issues: data.issues ?? [],
    artifacts: data.artifacts ?? [],
    goals: data.goals ?? [],
    notes: data.notes ?? [],
    links: data.links ?? [],
  };
}

export async function updateProjectRequest(
  id: string,
  input: {
    readonly name?: string;
    readonly instructions?: string;
    readonly status?: ProjectStatus;
    readonly priority?: ProjectPriority;
    readonly startDate?: string | null;
    readonly targetDate?: string | null;
  },
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

export async function linkProjectPinRequest(
  projectId: string,
  input:
    | { readonly pinId: string }
    | {
        readonly owner: string;
        readonly name: string;
        readonly fullName?: string;
        readonly vercelProjectId?: string | null;
        readonly vercelTeamId?: string | null;
        readonly expoProjectId?: string | null;
        readonly expoUpdateChannel?: string | null;
      },
): Promise<ProjectPinDto> {
  const response = await fetch(
    `${AGENT_URL}/api/projects/${encodeURIComponent(projectId)}/pins`,
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

  const data = (await response.json()) as { pin: ProjectPinDto };
  return data.pin;
}

export async function unlinkProjectPinRequest(
  projectId: string,
  pinId: string,
): Promise<void> {
  const response = await fetch(
    `${AGENT_URL}/api/projects/${encodeURIComponent(projectId)}/pins/${encodeURIComponent(pinId)}`,
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

export async function linkProjectArtifactRequest(
  projectId: string,
  pathname: string,
): Promise<ProjectArtifactDto> {
  const response = await fetch(
    `${AGENT_URL}/api/projects/${encodeURIComponent(projectId)}/artifacts`,
    {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ pathname }),
    },
  );

  if (!response.ok) {
    handleAuth(response);
    throw new Error(await readError(response));
  }

  const data = (await response.json()) as { artifact: ProjectArtifactDto };
  return data.artifact;
}

export async function unlinkProjectArtifactRequest(
  projectId: string,
  artifactId: string,
): Promise<void> {
  const response = await fetch(
    `${AGENT_URL}/api/projects/${encodeURIComponent(projectId)}/artifacts/${encodeURIComponent(artifactId)}`,
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

export async function createProjectFileRequest(
  projectId: string,
  input: { readonly title: string; readonly markdown?: string; readonly slug?: string },
): Promise<ProjectArtifactDto> {
  const response = await fetch(
    `${AGENT_URL}/api/projects/${encodeURIComponent(projectId)}/files`,
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

  const data = (await response.json()) as { artifact: ProjectArtifactDto };
  return data.artifact;
}

export async function fetchProjectFileContent(
  projectId: string,
  artifactId: string,
): Promise<{
  readonly artifact: ProjectArtifactDto;
  readonly content: string;
  readonly path: string;
}> {
  const response = await fetch(
    `${AGENT_URL}/api/projects/${encodeURIComponent(projectId)}/files/${encodeURIComponent(artifactId)}`,
    { headers: authHeaders() },
  );

  if (!response.ok) {
    handleAuth(response);
    throw new Error(await readError(response));
  }

  return (await response.json()) as {
    artifact: ProjectArtifactDto;
    content: string;
    path: string;
  };
}

export async function updateProjectFileRequest(
  projectId: string,
  artifactId: string,
  input: { readonly title?: string; readonly content?: string },
): Promise<{
  readonly artifact: ProjectArtifactDto;
  readonly content: string;
  readonly path: string;
}> {
  const response = await fetch(
    `${AGENT_URL}/api/projects/${encodeURIComponent(projectId)}/files/${encodeURIComponent(artifactId)}`,
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

  return (await response.json()) as {
    artifact: ProjectArtifactDto;
    content: string;
    path: string;
  };
}

export async function carryOutProjectFileRequest(
  projectId: string,
  artifactId: string,
): Promise<{ readonly chatId: string; readonly projectId: string }> {
  const response = await fetch(
    `${AGENT_URL}/api/projects/${encodeURIComponent(projectId)}/files/${encodeURIComponent(artifactId)}`,
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

export async function createProjectGoalRequest(
  projectId: string,
  input: {
    readonly title: string;
    readonly targetDate?: string | null;
    readonly notes?: string | null;
  },
): Promise<ProjectGoalDto> {
  const response = await fetch(
    `${AGENT_URL}/api/projects/${encodeURIComponent(projectId)}/goals`,
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

  const data = (await response.json()) as { goal: ProjectGoalDto };
  return data.goal;
}

export async function updateProjectGoalRequest(
  projectId: string,
  goalId: string,
  input: {
    readonly title?: string;
    readonly status?: "active" | "done";
    readonly targetDate?: string | null;
    readonly notes?: string | null;
  },
): Promise<ProjectGoalDto> {
  const response = await fetch(
    `${AGENT_URL}/api/projects/${encodeURIComponent(projectId)}/goals/${encodeURIComponent(goalId)}`,
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

  const data = (await response.json()) as { goal: ProjectGoalDto };
  return data.goal;
}

export async function deleteProjectGoalRequest(
  projectId: string,
  goalId: string,
): Promise<void> {
  const response = await fetch(
    `${AGENT_URL}/api/projects/${encodeURIComponent(projectId)}/goals/${encodeURIComponent(goalId)}`,
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

export async function createProjectLinkRequest(
  projectId: string,
  input: { readonly title: string; readonly url: string },
): Promise<ProjectLinkDto> {
  const response = await fetch(
    `${AGENT_URL}/api/projects/${encodeURIComponent(projectId)}/links`,
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

  const data = (await response.json()) as { link: ProjectLinkDto };
  return data.link;
}

export async function updateProjectLinkRequest(
  projectId: string,
  linkId: string,
  input: { readonly title?: string; readonly url?: string },
): Promise<ProjectLinkDto> {
  const response = await fetch(
    `${AGENT_URL}/api/projects/${encodeURIComponent(projectId)}/links/${encodeURIComponent(linkId)}`,
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

  const data = (await response.json()) as { link: ProjectLinkDto };
  return data.link;
}

export async function deleteProjectLinkRequest(
  projectId: string,
  linkId: string,
): Promise<void> {
  const response = await fetch(
    `${AGENT_URL}/api/projects/${encodeURIComponent(projectId)}/links/${encodeURIComponent(linkId)}`,
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


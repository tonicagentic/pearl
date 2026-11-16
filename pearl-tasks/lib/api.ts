import { PEARL_URL } from "./config";
import { getSessionToken } from "./auth";

export type IssueState = "active" | "dormant" | "resolved";

export type IssueDto = {
  id: string;
  title: string;
  description: string | null;
  status: "open" | "resolved";
  dueDate: string | null;
  reviewDate: string | null;
  createdAt: string;
  resolvedAt: string | null;
  areaId: string;
  areaName: string;
  projectId: string | null;
  state: IssueState;
  dueSoon?: boolean;
};

export type ProjectDto = {
  id: string;
  name: string;
  instructions: string;
  createdAt: string;
  updatedAt: string;
};

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getSessionToken();
  return {
    "content-type": "application/json",
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  };
}

async function readError(response: Response): Promise<string> {
  const body = (await response.json().catch(() => ({}))) as {
    error?: string;
  };
  return body.error ?? `Request failed (${response.status}).`;
}

async function postIssueOp(
  body: Record<string, unknown>,
): Promise<{ response: Response; json: { error?: string; issue?: IssueDto; deleted?: boolean } }> {
  const response = await fetch(`${PEARL_URL}/api/issues`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify(body),
  });
  const json = (await response.json().catch(() => ({}))) as {
    error?: string;
    issue?: IssueDto;
    deleted?: boolean;
  };
  return { response, json };
}

export async function fetchIssues(): Promise<{
  issues: IssueDto[];
  viewer: { id: string; name: string; email: string };
}> {
  const response = await fetch(`${PEARL_URL}/api/issues`, {
    headers: await authHeaders(),
  });
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  return (await response.json()) as {
    issues: IssueDto[];
    viewer: { id: string; name: string; email: string };
  };
}

export async function fetchIssue(id: string): Promise<IssueDto> {
  const { response, json } = await postIssueOp({ op: "get", id });
  if (!response.ok || !json.issue) {
    throw new Error(json.error ?? `Failed to load task (${response.status}).`);
  }
  return json.issue;
}

export async function createIssue(input: {
  title: string;
  description?: string;
  projectId?: string | null;
  dueDate?: string | null;
  reviewDate?: string | null;
}): Promise<IssueDto> {
  const { response, json } = await postIssueOp({
    op: "create",
    areaName: "Inbox",
    ...input,
  });
  if (!response.ok || !json.issue) {
    throw new Error(json.error ?? `Failed to create task (${response.status}).`);
  }
  return json.issue;
}

export async function updateIssue(
  id: string,
  input: {
    title?: string;
    description?: string | null;
    projectId?: string | null;
    dueDate?: string | null;
    reviewDate?: string | null;
  },
): Promise<IssueDto> {
  const { response, json } = await postIssueOp({
    op: "update",
    id,
    ...input,
  });
  if (!response.ok || !json.issue) {
    throw new Error(json.error ?? `Failed to update task (${response.status}).`);
  }
  return json.issue;
}

export async function setIssueResolved(
  id: string,
  resolved: boolean,
): Promise<IssueDto> {
  const { response, json } = await postIssueOp({
    op: resolved ? "resolve" : "reopen",
    id,
  });
  if (!response.ok || !json.issue) {
    throw new Error(json.error ?? `Failed to update task (${response.status}).`);
  }
  return json.issue;
}

export async function deleteIssue(id: string): Promise<void> {
  const { response, json } = await postIssueOp({ op: "delete", id });
  if (!response.ok || !json.deleted) {
    throw new Error(json.error ?? `Failed to delete task (${response.status}).`);
  }
}

export async function fetchProjects(): Promise<ProjectDto[]> {
  const response = await fetch(`${PEARL_URL}/api/projects`, {
    headers: await authHeaders(),
  });
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  const data = (await response.json()) as { projects: ProjectDto[] };
  return data.projects;
}

export async function createProject(input: {
  name: string;
  instructions?: string;
}): Promise<ProjectDto> {
  const response = await fetch(`${PEARL_URL}/api/projects`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  const data = (await response.json()) as { project: ProjectDto };
  return data.project;
}

export async function updateProject(
  id: string,
  input: { name?: string; instructions?: string },
): Promise<ProjectDto> {
  const response = await fetch(
    `${PEARL_URL}/api/projects/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: await authHeaders(),
      body: JSON.stringify(input),
    },
  );
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  const data = (await response.json()) as { project: ProjectDto };
  return data.project;
}

export async function deleteProject(id: string): Promise<void> {
  const response = await fetch(
    `${PEARL_URL}/api/projects/${encodeURIComponent(id)}`,
    {
      method: "DELETE",
      headers: await authHeaders(),
    },
  );
  if (!response.ok) {
    throw new Error(await readError(response));
  }
}

export function todayIso(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function groupIssues(issues: readonly IssueDto[]) {
  const today = todayIso();
  const open = issues.filter((issue) => issue.status === "open");
  const due = open.filter(
    (issue) => issue.dueDate !== null && issue.dueDate <= today,
  );
  const parked = open.filter(
    (issue) =>
      issue.reviewDate !== null &&
      issue.reviewDate > today &&
      !(issue.dueDate !== null && issue.dueDate <= today),
  );
  const later = open.filter(
    (issue) => !due.includes(issue) && !parked.includes(issue),
  );
  const done = issues.filter((issue) => issue.status === "resolved");
  return { due, later, parked, done };
}

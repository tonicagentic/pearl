// Tasks (issues) data client for the mobile app: hits the web app's /api/issues
// routes with the same better-auth credential the eve transport uses.

import { AGENT_URL, getAuthCookie } from './eve-transport';
import { sessionInvalid } from './session-store';

export type IssueState = 'active' | 'dormant' | 'resolved';

export type IssueDto = {
  id: string;
  title: string;
  description: string | null;
  status: 'open' | 'resolved';
  dueDate: string | null;
  reviewDate: string | null;
  createdAt: string;
  resolvedAt: string | null;
  areaId: string;
  areaName: string;
  state: IssueState;
  dueSoon?: boolean;
};

export type IssuesPayload = {
  viewer: { id: string; name: string; email: string };
  issues: IssueDto[];
  options: { id: string; label: string }[];
};

/** Default area for mobile-created tasks (areas stay in DB, hidden from UI). */
export const DEFAULT_TASK_AREA = 'Inbox';

function authHeaders(): Record<string, string> {
  const credential = getAuthCookie();

  return {
    'content-type': 'application/json',
    ...(credential ? { authorization: `Bearer ${credential}` } : {}),
  };
}

async function postIssueOp(
  body: Record<string, unknown>,
): Promise<{ response: Response; json: { error?: string; issue?: IssueDto; deleted?: boolean; id?: string } }> {
  const response = await fetch(`${AGENT_URL}/api/issues`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });

  const json = (await response.json().catch(() => ({}))) as {
    error?: string;
    issue?: IssueDto;
    deleted?: boolean;
    id?: string;
  };

  if (response.status === 401) {
    sessionInvalid();
  }

  return { response, json };
}

export async function fetchIssues(): Promise<IssuesPayload> {
  const response = await fetch(`${AGENT_URL}/api/issues`, {
    headers: authHeaders(),
  });

  if (!response.ok) {
    if (response.status === 401) {
      sessionInvalid();
    }
    const body = await response.text().catch(() => '');
    throw new Error(`Failed to load tasks (${response.status}) ${body.slice(0, 120)}`);
  }

  return (await response.json()) as IssuesPayload;
}

export type CreateIssueInput = {
  readonly title: string;
  readonly areaName?: string;
  readonly description?: string;
  readonly dueDate?: string | null;
  readonly reviewDate?: string | null;
};

export async function createIssueRequest(input: CreateIssueInput): Promise<IssueDto> {
  const { response, json } = await postIssueOp({
    op: 'create',
    ...input,
    areaName: input.areaName?.trim() || DEFAULT_TASK_AREA,
  });

  if (!response.ok || !json.issue) {
    throw new Error(json.error ?? `Failed to create the task (${response.status}).`);
  }

  return json.issue;
}

export async function setIssueResolvedRequest(id: string, resolved: boolean): Promise<IssueDto> {
  const { response, json } = await postIssueOp({
    op: resolved ? 'resolve' : 'reopen',
    id,
  });

  if (!response.ok || !json.issue) {
    throw new Error(json.error ?? `Failed to update the task (${response.status}).`);
  }

  return json.issue;
}

export type UpdateIssueInput = {
  readonly title?: string;
  readonly description?: string | null;
  readonly dueDate?: string | null;
  readonly reviewDate?: string | null;
};

export async function updateIssueRequest(
  id: string,
  input: UpdateIssueInput,
): Promise<IssueDto> {
  const { response, json } = await postIssueOp({
    op: 'update',
    id,
    ...input,
  });

  if (!response.ok || !json.issue) {
    throw new Error(json.error ?? `Failed to update the task (${response.status}).`);
  }

  return json.issue;
}

export async function deleteIssueRequest(id: string): Promise<void> {
  const { response, json } = await postIssueOp({
    op: 'delete',
    id,
  });

  if (!response.ok || !json.deleted) {
    throw new Error(json.error ?? `Failed to delete the task (${response.status}).`);
  }
}

// Issues data client for the mobile app: hits the web app's /api/issues
// routes with the same better-auth session cookie the eve transport uses, so
// both surfaces read and write the same principal-scoped data.

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
  responsibilityId: string;
  responsibilityName: string;
  state: IssueState;
  dueSoon?: boolean;
};

export type IssuesPayload = {
  viewer: { id: string; name: string; email: string };
  issues: IssueDto[];
  options: { id: string; label: string }[];
};

function authHeaders(): Record<string, string> {
  const cookie = getAuthCookie();

  return {
    'content-type': 'application/json',
    ...(cookie ? { cookie } : {}),
  };
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
    throw new Error(`Failed to load issues (${response.status}) ${body.slice(0, 120)}`);
  }

  return (await response.json()) as IssuesPayload;
}

export type CreateIssueInput = {
  readonly title: string;
  readonly responsibilityName?: string;
  readonly description?: string;
  readonly dueDate?: string | null;
  readonly reviewDate?: string | null;
};

export async function createIssueRequest(input: CreateIssueInput): Promise<IssueDto> {
  const response = await fetch(`${AGENT_URL}/api/issues`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ op: 'create', ...input }),
  });

  const body = (await response.json().catch(() => ({}))) as {
    error?: string;
    issue?: IssueDto;
  };

  if (!response.ok || !body.issue) {
    if (response.status === 401) {
      sessionInvalid();
    }
    throw new Error(body.error ?? `Failed to create the issue (${response.status}).`);
  }

  return body.issue;
}

export async function setIssueResolvedRequest(id: string, resolved: boolean): Promise<IssueDto> {
  const response = await fetch(`${AGENT_URL}/api/issues`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ op: resolved ? 'resolve' : 'reopen', id }),
  });

  const body = (await response.json().catch(() => ({}))) as {
    error?: string;
    issue?: IssueDto;
  };

  if (!response.ok || !body.issue) {
    if (response.status === 401) {
      sessionInvalid();
    }
    throw new Error(body.error ?? `Failed to update the issue (${response.status}).`);
  }

  return body.issue;
}

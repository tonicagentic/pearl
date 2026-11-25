import { AGENT_URL, getAuthCookie } from "./eve-transport";
import { sessionInvalid } from "./session-store";

export type GoalDto = {
  readonly id: string;
  readonly projectId: string | null;
  readonly projectName: string | null;
  readonly title: string;
  readonly status: "active" | "done";
  readonly targetDate: string | null;
  readonly notes: string | null;
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

export async function fetchAllGoals(): Promise<readonly GoalDto[]> {
  const response = await fetch(`${AGENT_URL}/api/goals`, {
    headers: authHeaders(),
  });
  if (!response.ok) {
    handleAuth(response);
    throw new Error(await readError(response));
  }
  const data = (await response.json()) as { goals: GoalDto[] };
  return data.goals;
}

export async function createGoalRequest(input: {
  readonly title: string;
  readonly projectId?: string | null;
  readonly targetDate?: string | null;
  readonly notes?: string | null;
}): Promise<GoalDto> {
  const response = await fetch(`${AGENT_URL}/api/goals`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    handleAuth(response);
    throw new Error(await readError(response));
  }
  const data = (await response.json()) as { goal: GoalDto };
  return data.goal;
}

export async function updateGoalRequest(
  goalId: string,
  input: {
    readonly title?: string;
    readonly status?: "active" | "done";
    readonly targetDate?: string | null;
    readonly notes?: string | null;
    readonly projectId?: string | null;
  },
): Promise<GoalDto> {
  const response = await fetch(
    `${AGENT_URL}/api/goals/${encodeURIComponent(goalId)}`,
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
  const data = (await response.json()) as { goal: GoalDto };
  return data.goal;
}

export async function deleteGoalRequest(goalId: string): Promise<void> {
  const response = await fetch(
    `${AGENT_URL}/api/goals/${encodeURIComponent(goalId)}`,
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

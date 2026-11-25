import { authedJson, authedVoid } from "./http";

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

export async function fetchAllGoals(): Promise<readonly GoalDto[]> {
  const data = await authedJson<{ goals: GoalDto[] }>("/api/goals");
  return data.goals;
}

export async function createGoalRequest(input: {
  readonly title: string;
  readonly projectId?: string | null;
  readonly targetDate?: string | null;
  readonly notes?: string | null;
}): Promise<GoalDto> {
  const data = await authedJson<{ goal: GoalDto }>("/api/goals", {
    method: "POST",
    json: input,
  });
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
  const data = await authedJson<{ goal: GoalDto }>(
    `/api/goals/${encodeURIComponent(goalId)}`,
    { method: "PATCH", json: input },
  );
  return data.goal;
}

export async function deleteGoalRequest(goalId: string): Promise<void> {
  await authedVoid(`/api/goals/${encodeURIComponent(goalId)}`, {
    method: "DELETE",
  });
}
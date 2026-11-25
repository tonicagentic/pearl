import { and, asc, desc, eq, sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { getProject } from "@/lib/db/projects";
import {
  project,
  projectGoal,
  type ProjectGoal,
  type ProjectGoalStatus,
} from "@/lib/db/schema";

const MAX_TITLE = 200;
const MAX_NOTES = 20_000;

export type ProjectGoalDto = {
  readonly id: string;
  readonly projectId: string | null;
  readonly projectName: string | null;
  readonly title: string;
  readonly status: ProjectGoalStatus;
  readonly targetDate: string | null;
  readonly notes: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

function toDto(
  row: ProjectGoal,
  projectName: string | null = null,
): ProjectGoalDto {
  return {
    id: row.id,
    projectId: row.projectId,
    projectName,
    title: row.title,
    status: row.status,
    targetDate: row.targetDate,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function requireTitle(title: string): string {
  const trimmed = title.trim();
  if (!trimmed) throw new Error("A goal needs a title.");
  if (trimmed.length > MAX_TITLE) {
    throw new Error(`Goal titles must be ${MAX_TITLE} characters or fewer.`);
  }
  return trimmed;
}

function normalizeTargetDate(value: string | null | undefined): string | null {
  if (value === undefined || value === null || value.trim() === "") return null;
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw new Error("targetDate must be YYYY-MM-DD.");
  }
  return trimmed;
}

async function resolveOptionalProjectId(
  userId: string,
  projectId: string | null | undefined,
): Promise<string | null> {
  if (projectId === undefined || projectId === null || projectId.trim() === "") {
    return null;
  }
  const owned = await getProject(userId, projectId.trim());
  if (!owned) throw new Error("Unknown project.");
  return owned.id;
}

export async function listAllGoals(
  userId: string,
): Promise<readonly ProjectGoalDto[]> {
  const rows = await db
    .select({
      goal: projectGoal,
      projectName: project.name,
    })
    .from(projectGoal)
    .leftJoin(project, eq(projectGoal.projectId, project.id))
    .where(eq(projectGoal.userId, userId))
    .orderBy(
      sql`case when ${projectGoal.status} = 'active' then 0 else 1 end`,
      asc(projectGoal.targetDate),
      desc(projectGoal.updatedAt),
    );

  return rows.map((row) => toDto(row.goal, row.projectName ?? null));
}

export async function listProjectGoals(
  userId: string,
  projectId: string,
): Promise<readonly ProjectGoalDto[]> {
  const owned = await getProject(userId, projectId);
  if (!owned) return [];

  const rows = await db
    .select()
    .from(projectGoal)
    .where(
      and(
        eq(projectGoal.projectId, projectId),
        eq(projectGoal.userId, userId),
      ),
    )
    .orderBy(
      sql`case when ${projectGoal.status} = 'active' then 0 else 1 end`,
      asc(projectGoal.targetDate),
      asc(projectGoal.updatedAt),
    );

  return rows.map((row) => toDto(row, owned.name));
}

export async function getGoal(
  userId: string,
  goalId: string,
): Promise<ProjectGoalDto | null> {
  const [row] = await db
    .select({
      goal: projectGoal,
      projectName: project.name,
    })
    .from(projectGoal)
    .leftJoin(project, eq(projectGoal.projectId, project.id))
    .where(and(eq(projectGoal.id, goalId), eq(projectGoal.userId, userId)))
    .limit(1);
  return row ? toDto(row.goal, row.projectName ?? null) : null;
}

export async function getProjectGoal(
  userId: string,
  projectId: string,
  goalId: string,
): Promise<ProjectGoalDto | null> {
  const goal = await getGoal(userId, goalId);
  if (!goal || goal.projectId !== projectId) return null;
  return goal;
}

export async function createGoal(
  userId: string,
  input: {
    readonly title: string;
    readonly projectId?: string | null;
    readonly targetDate?: string | null;
    readonly notes?: string | null;
  },
): Promise<ProjectGoalDto> {
  const projectId = await resolveOptionalProjectId(userId, input.projectId);
  const title = requireTitle(input.title);
  const targetDate = normalizeTargetDate(input.targetDate);
  const notes =
    input.notes === undefined || input.notes === null
      ? null
      : input.notes.slice(0, MAX_NOTES);

  const [row] = await db
    .insert(projectGoal)
    .values({
      userId,
      projectId,
      title,
      targetDate,
      notes,
    })
    .returning();
  if (!row) throw new Error("Failed to create goal.");

  let projectName: string | null = null;
  if (projectId) {
    const owned = await getProject(userId, projectId);
    projectName = owned?.name ?? null;
  }
  return toDto(row, projectName);
}

export async function createProjectGoal(
  userId: string,
  projectId: string,
  input: {
    readonly title: string;
    readonly targetDate?: string | null;
    readonly notes?: string | null;
  },
): Promise<ProjectGoalDto | null> {
  const owned = await getProject(userId, projectId);
  if (!owned) return null;
  return createGoal(userId, { ...input, projectId });
}

export async function updateGoal(
  userId: string,
  goalId: string,
  input: {
    readonly title?: string;
    readonly status?: ProjectGoalStatus;
    readonly targetDate?: string | null;
    readonly notes?: string | null;
    readonly projectId?: string | null;
  },
): Promise<ProjectGoalDto | null> {
  const existing = await getGoal(userId, goalId);
  if (!existing) return null;

  const title =
    input.title !== undefined ? requireTitle(input.title) : existing.title;
  const status =
    input.status !== undefined
      ? input.status === "done"
        ? "done"
        : "active"
      : existing.status;
  const targetDate =
    input.targetDate !== undefined
      ? normalizeTargetDate(input.targetDate)
      : existing.targetDate;
  const notes =
    input.notes !== undefined
      ? input.notes === null
        ? null
        : input.notes.slice(0, MAX_NOTES)
      : existing.notes;
  const projectId =
    input.projectId !== undefined
      ? await resolveOptionalProjectId(userId, input.projectId)
      : existing.projectId;

  const [row] = await db
    .update(projectGoal)
    .set({
      title,
      status,
      targetDate,
      notes,
      projectId,
      updatedAt: new Date(),
    })
    .where(and(eq(projectGoal.id, goalId), eq(projectGoal.userId, userId)))
    .returning();
  if (!row) return null;

  let projectName: string | null = null;
  if (row.projectId) {
    const owned = await getProject(userId, row.projectId);
    projectName = owned?.name ?? null;
  }
  return toDto(row, projectName);
}

export async function updateProjectGoal(
  userId: string,
  projectId: string,
  goalId: string,
  input: {
    readonly title?: string;
    readonly status?: ProjectGoalStatus;
    readonly targetDate?: string | null;
    readonly notes?: string | null;
  },
): Promise<ProjectGoalDto | null> {
  const existing = await getProjectGoal(userId, projectId, goalId);
  if (!existing) return null;
  return updateGoal(userId, goalId, input);
}

export async function deleteGoal(
  userId: string,
  goalId: string,
): Promise<boolean> {
  const deleted = await db
    .delete(projectGoal)
    .where(and(eq(projectGoal.id, goalId), eq(projectGoal.userId, userId)))
    .returning({ id: projectGoal.id });
  return deleted.length > 0;
}

export async function deleteProjectGoal(
  userId: string,
  projectId: string,
  goalId: string,
): Promise<boolean> {
  const existing = await getProjectGoal(userId, projectId, goalId);
  if (!existing) return false;
  return deleteGoal(userId, goalId);
}

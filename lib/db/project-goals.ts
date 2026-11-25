import { and, asc, eq, sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { getProject } from "@/lib/db/projects";
import {
  projectGoal,
  type ProjectGoal,
  type ProjectGoalStatus,
} from "@/lib/db/schema";

const MAX_TITLE = 200;
const MAX_NOTES = 20_000;

export type ProjectGoalDto = {
  readonly id: string;
  readonly projectId: string;
  readonly title: string;
  readonly status: ProjectGoalStatus;
  readonly targetDate: string | null;
  readonly notes: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

function toDto(row: ProjectGoal): ProjectGoalDto {
  return {
    id: row.id,
    projectId: row.projectId,
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

  return rows.map(toDto);
}

export async function getProjectGoal(
  userId: string,
  projectId: string,
  goalId: string,
): Promise<ProjectGoalDto | null> {
  const [row] = await db
    .select()
    .from(projectGoal)
    .where(
      and(
        eq(projectGoal.id, goalId),
        eq(projectGoal.projectId, projectId),
        eq(projectGoal.userId, userId),
      ),
    )
    .limit(1);
  return row ? toDto(row) : null;
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
  return toDto(row);
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

  const [row] = await db
    .update(projectGoal)
    .set({
      title,
      status,
      targetDate,
      notes,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(projectGoal.id, goalId),
        eq(projectGoal.projectId, projectId),
        eq(projectGoal.userId, userId),
      ),
    )
    .returning();
  return row ? toDto(row) : null;
}

export async function deleteProjectGoal(
  userId: string,
  projectId: string,
  goalId: string,
): Promise<boolean> {
  const deleted = await db
    .delete(projectGoal)
    .where(
      and(
        eq(projectGoal.id, goalId),
        eq(projectGoal.projectId, projectId),
        eq(projectGoal.userId, userId),
      ),
    )
    .returning({ id: projectGoal.id });
  return deleted.length > 0;
}

import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";

import { insertProjectManager } from "@/lib/custom-agents/store";
import { db } from "@/lib/db/client";
import {
  chat,
  project,
  type Project,
  type ProjectPriority,
  type ProjectStatus,
} from "@/lib/db/schema";

const MAX_NAME = 120;
const MAX_INSTRUCTIONS = 20_000;
const MAX_SLUG = 80;

const PROJECT_STATUSES = [
  "backlog",
  "planned",
  "in_progress",
  "ongoing",
  "completed",
  "canceled",
] as const satisfies readonly ProjectStatus[];

const PROJECT_PRIORITIES = [
  "none",
  "urgent",
  "high",
  "medium",
  "low",
] as const satisfies readonly ProjectPriority[];

function slugify(input: string): string {
  const base = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG);
  return base || "plan";
}

function requireName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("A project needs a name.");
  if (trimmed.length > MAX_NAME) {
    throw new Error(`Project names must be ${MAX_NAME} characters or fewer.`);
  }
  return trimmed;
}

function requireStatus(value: string): ProjectStatus {
  if ((PROJECT_STATUSES as readonly string[]).includes(value)) {
    return value as ProjectStatus;
  }
  throw new Error(
    `status must be one of: ${PROJECT_STATUSES.join(", ")}.`,
  );
}

function requirePriority(value: string): ProjectPriority {
  if ((PROJECT_PRIORITIES as readonly string[]).includes(value)) {
    return value as ProjectPriority;
  }
  throw new Error(
    `priority must be one of: ${PROJECT_PRIORITIES.join(", ")}.`,
  );
}

function normalizeProjectDate(
  value: string | null | undefined,
  field: "startDate" | "targetDate",
): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value.trim() === "") return null;
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw new Error(`${field} must be YYYY-MM-DD.`);
  }
  return trimmed;
}

export async function listProjects(
  userId: string,
): Promise<readonly Project[]> {
  return db
    .select()
    .from(project)
    .where(eq(project.userId, userId))
    .orderBy(asc(project.name));
}

export async function getProject(
  userId: string,
  projectId: string,
): Promise<Project | null> {
  const [row] = await db
    .select()
    .from(project)
    .where(and(eq(project.userId, userId), eq(project.id, projectId)))
    .limit(1);
  return row ?? null;
}

export async function getProjectByName(
  userId: string,
  name: string,
): Promise<Project | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const [row] = await db
    .select()
    .from(project)
    .where(
      and(
        eq(project.userId, userId),
        sql`lower(${project.name}) = lower(${trimmed})`,
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function createProject(
  userId: string,
  input: {
    readonly name: string;
    readonly instructions?: string;
    readonly status?: ProjectStatus;
    readonly priority?: ProjectPriority;
    readonly startDate?: string | null;
    readonly targetDate?: string | null;
  },
): Promise<Project> {
  const name = requireName(input.name);
  const instructions = (input.instructions ?? "").slice(0, MAX_INSTRUCTIONS);
  const status =
    input.status !== undefined ? requireStatus(input.status) : "backlog";
  const priority =
    input.priority !== undefined ? requirePriority(input.priority) : "none";
  const startDate = normalizeProjectDate(input.startDate, "startDate");
  const targetDateRaw = normalizeProjectDate(input.targetDate, "targetDate");
  const targetDate =
    status === "ongoing"
      ? null
      : targetDateRaw === undefined
        ? null
        : targetDateRaw;
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(project)
      .values({
        userId,
        name,
        instructions,
        status,
        priority,
        startDate: startDate === undefined ? null : startDate,
        targetDate,
      })
      .returning();
    if (!row) throw new Error("Failed to create project.");
    await insertProjectManager(tx, userId, row.id);
    return row;
  });
}

/** Persist a lazily provisioned Vercel Drive name for this project. */
export async function setProjectDriveName(
  userId: string,
  projectId: string,
  driveName: string,
): Promise<string | null> {
  const trimmed = driveName.trim().slice(0, 64);
  if (!trimmed) return null;
  const [row] = await db
    .update(project)
    .set({ driveName: trimmed, updatedAt: new Date() })
    .where(
      and(
        eq(project.userId, userId),
        eq(project.id, projectId),
        sql`${project.driveName} is null`,
      ),
    )
    .returning({ driveName: project.driveName });
  if (row?.driveName) return row.driveName;
  const existing = await getProject(userId, projectId);
  return existing?.driveName ?? null;
}

export async function updateProject(
  userId: string,
  projectId: string,
  input: {
    readonly name?: string;
    readonly instructions?: string;
    readonly status?: ProjectStatus;
    readonly priority?: ProjectPriority;
    readonly startDate?: string | null;
    readonly targetDate?: string | null;
  },
): Promise<Project | null> {
  const existing = await getProject(userId, projectId);
  if (!existing) return null;

  const name =
    input.name !== undefined ? requireName(input.name) : existing.name;
  const instructions =
    input.instructions !== undefined
      ? input.instructions.slice(0, MAX_INSTRUCTIONS)
      : existing.instructions;
  const status =
    input.status !== undefined ? requireStatus(input.status) : existing.status;
  const priority =
    input.priority !== undefined
      ? requirePriority(input.priority)
      : existing.priority;
  const startDateRaw = normalizeProjectDate(input.startDate, "startDate");
  const targetDateRaw = normalizeProjectDate(input.targetDate, "targetDate");
  const startDate =
    startDateRaw === undefined ? existing.startDate : startDateRaw;
  // Ongoing projects have no end target — clear on status change, ignore new targets.
  let targetDate =
    targetDateRaw === undefined ? existing.targetDate : targetDateRaw;
  if (status === "ongoing") {
    targetDate = null;
  }

  const [row] = await db
    .update(project)
    .set({
      name,
      instructions,
      status,
      priority,
      startDate,
      targetDate,
      updatedAt: new Date(),
    })
    .where(and(eq(project.userId, userId), eq(project.id, projectId)))
    .returning();
  return row ?? null;
}

export async function deleteProject(
  userId: string,
  projectId: string,
): Promise<boolean> {
  const deleted = await db
    .delete(project)
    .where(and(eq(project.userId, userId), eq(project.id, projectId)))
    .returning({ id: project.id });
  return deleted.length > 0;
}

export async function listProjectChats(
  userId: string,
  projectId: string,
): Promise<readonly { id: string; title: string; updatedAt: Date }[]> {
  // Pearl project threads only — custom-agent chats stay out of the project list.
  return db
    .select({
      id: chat.id,
      title: chat.title,
      updatedAt: chat.updatedAt,
    })
    .from(chat)
    .where(
      and(
        eq(chat.userId, userId),
        eq(chat.projectId, projectId),
        isNull(chat.customAgentId),
      ),
    )
    .orderBy(desc(chat.updatedAt));
}

export async function listGoalChats(
  userId: string,
  goalId: string,
): Promise<readonly { id: string; title: string; updatedAt: Date }[]> {
  return db
    .select({
      id: chat.id,
      title: chat.title,
      updatedAt: chat.updatedAt,
    })
    .from(chat)
    .where(
      and(
        eq(chat.userId, userId),
        eq(chat.goalId, goalId),
        isNull(chat.customAgentId),
      ),
    )
    .orderBy(desc(chat.updatedAt));
}

export async function setChatProject(
  userId: string,
  chatId: string,
  projectId: string | null,
): Promise<boolean> {
  if (projectId) {
    const owned = await getProject(userId, projectId);
    if (!owned) return false;
  }
  const updated = await db
    .update(chat)
    .set({ projectId, updatedAt: new Date() })
    .where(and(eq(chat.userId, userId), eq(chat.id, chatId)))
    .returning({ id: chat.id });
  return updated.length > 0;
}

export async function setChatGoal(
  userId: string,
  chatId: string,
  goalId: string | null,
  options?: { readonly projectId?: string | null },
): Promise<boolean> {
  if (goalId) {
    const { getGoal } = await import("@/lib/db/project-goals");
    const owned = await getGoal(userId, goalId);
    if (!owned) return false;
  }

  const patch: {
    goalId: string | null;
    updatedAt: Date;
    projectId?: string | null;
  } = { goalId, updatedAt: new Date() };

  if (options?.projectId !== undefined) {
    if (options.projectId) {
      const owned = await getProject(userId, options.projectId);
      if (!owned) return false;
    }
    patch.projectId = options.projectId;
  }

  const updated = await db
    .update(chat)
    .set(patch)
    .where(and(eq(chat.userId, userId), eq(chat.id, chatId)))
    .returning({ id: chat.id });
  return updated.length > 0;
}

export async function getChatProjectId(
  userId: string,
  chatId: string,
): Promise<string | null> {
  const [row] = await db
    .select({ projectId: chat.projectId })
    .from(chat)
    .where(and(eq(chat.userId, userId), eq(chat.id, chatId)))
    .limit(1);
  return row?.projectId ?? null;
}

export {
  PROJECT_PRIORITIES,
  PROJECT_STATUSES,
  slugify,
};

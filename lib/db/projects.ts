import { and, asc, desc, eq, sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { chat, project, type Project } from "@/lib/db/schema";

const MAX_NAME = 120;
const MAX_INSTRUCTIONS = 20_000;
const MAX_SLUG = 80;

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
  input: { readonly name: string; readonly instructions?: string },
): Promise<Project> {
  const name = requireName(input.name);
  const instructions = (input.instructions ?? "").slice(0, MAX_INSTRUCTIONS);
  const [row] = await db
    .insert(project)
    .values({ userId, name, instructions })
    .returning();
  if (!row) throw new Error("Failed to create project.");
  return row;
}

export async function updateProject(
  userId: string,
  projectId: string,
  input: {
    readonly name?: string;
    readonly instructions?: string;
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

  const [row] = await db
    .update(project)
    .set({ name, instructions, updatedAt: new Date() })
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
  return db
    .select({
      id: chat.id,
      title: chat.title,
      updatedAt: chat.updatedAt,
    })
    .from(chat)
    .where(and(eq(chat.userId, userId), eq(chat.projectId, projectId)))
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

export { slugify };

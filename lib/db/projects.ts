import { and, asc, desc, eq, sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { chat, plan, project, type Plan, type Project } from "@/lib/db/schema";

const MAX_NAME = 120;
const MAX_INSTRUCTIONS = 20_000;
const MAX_TITLE = 200;
const MAX_MARKDOWN = 200_000;
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

export type PlanSummary = {
  readonly id: string;
  readonly title: string;
  readonly slug: string;
  readonly updatedAt: Date;
};

export async function listPlans(
  userId: string,
  projectId: string,
): Promise<readonly PlanSummary[]> {
  return db
    .select({
      id: plan.id,
      title: plan.title,
      slug: plan.slug,
      updatedAt: plan.updatedAt,
    })
    .from(plan)
    .where(and(eq(plan.userId, userId), eq(plan.projectId, projectId)))
    .orderBy(desc(plan.updatedAt));
}

export async function getPlan(
  userId: string,
  planId: string,
): Promise<Plan | null> {
  const [row] = await db
    .select()
    .from(plan)
    .where(and(eq(plan.userId, userId), eq(plan.id, planId)))
    .limit(1);
  return row ?? null;
}

export async function getPlanBySlug(
  userId: string,
  projectId: string,
  slug: string,
): Promise<Plan | null> {
  const [row] = await db
    .select()
    .from(plan)
    .where(
      and(
        eq(plan.userId, userId),
        eq(plan.projectId, projectId),
        eq(plan.slug, slug.trim()),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function savePlan(
  userId: string,
  input: {
    readonly projectId: string;
    readonly title: string;
    readonly slug?: string;
    readonly markdown: string;
    readonly planId?: string;
  },
): Promise<Plan> {
  const owned = await getProject(userId, input.projectId);
  if (!owned) {
    throw new Error("Unknown project.");
  }

  const title = input.title.trim();
  if (!title) throw new Error("A plan needs a title.");
  if (title.length > MAX_TITLE) {
    throw new Error(`Plan titles must be ${MAX_TITLE} characters or fewer.`);
  }

  const markdown = input.markdown.slice(0, MAX_MARKDOWN);
  const slug = slugify(input.slug?.trim() || title);

  if (input.planId) {
    const existing = await getPlan(userId, input.planId);
    if (!existing || existing.projectId !== input.projectId) {
      throw new Error("Unknown plan.");
    }
    const [row] = await db
      .update(plan)
      .set({ title, slug, markdown, updatedAt: new Date() })
      .where(and(eq(plan.userId, userId), eq(plan.id, input.planId)))
      .returning();
    if (!row) throw new Error("Failed to update plan.");
    return row;
  }

  const bySlug = await getPlanBySlug(userId, input.projectId, slug);
  if (bySlug) {
    const [row] = await db
      .update(plan)
      .set({ title, markdown, updatedAt: new Date() })
      .where(and(eq(plan.userId, userId), eq(plan.id, bySlug.id)))
      .returning();
    if (!row) throw new Error("Failed to update plan.");
    return row;
  }

  const [row] = await db
    .insert(plan)
    .values({
      userId,
      projectId: input.projectId,
      title,
      slug,
      markdown,
    })
    .returning();
  if (!row) throw new Error("Failed to create plan.");
  return row;
}

export async function deletePlan(
  userId: string,
  planId: string,
): Promise<boolean> {
  const deleted = await db
    .delete(plan)
    .where(and(eq(plan.userId, userId), eq(plan.id, planId)))
    .returning({ id: plan.id });
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

import { and, asc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import {
  isAgentIntegrationId,
  type AgentIntegrationId,
} from "@/lib/custom-agents/integrations";
import { CustomAgentError, getCustomAgent } from "@/lib/custom-agents/store";
import type {
  CustomAgentConfigBundle,
  CustomAgentIntegrationView,
  CustomAgentMemoryView,
  CustomAgentRoutineView,
  CustomAgentSkillView,
} from "@/lib/custom-agents/template-types";
import { db } from "@/lib/db/client";
import {
  customAgentIntegration,
  customAgentMemory,
  customAgentRoutine,
  customAgentSkill,
} from "@/lib/db/schema";

const MAX_MEMORY = 2000;
const MAX_SKILL_MARKDOWN = 50_000;
const MAX_ROUTINE_PROMPT = 20_000;

function memoryView(row: typeof customAgentMemory.$inferSelect): CustomAgentMemoryView {
  return {
    id: row.id,
    text: row.text,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function skillView(row: typeof customAgentSkill.$inferSelect): CustomAgentSkillView {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    markdown: row.markdown,
    enabled: row.enabled,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function routineView(
  row: typeof customAgentRoutine.$inferSelect,
): CustomAgentRoutineView {
  return {
    id: row.id,
    name: row.name,
    cron: row.cron,
    timezone: row.timezone,
    prompt: row.prompt,
    enabled: row.enabled,
    lastRunAt: row.lastRunAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function integrationView(
  row: typeof customAgentIntegration.$inferSelect,
): CustomAgentIntegrationView | null {
  if (!isAgentIntegrationId(row.connectionId)) return null;
  return {
    id: row.id,
    connectionId: row.connectionId,
    createdAt: row.createdAt.toISOString(),
  };
}

async function requireOwnedAgent(userId: string, agentId: string) {
  const agent = await getCustomAgent(userId, agentId);
  if (!agent) {
    throw new CustomAgentError("Unknown agent.");
  }
  return agent;
}

export async function getCustomAgentConfig(
  userId: string,
  agentId: string,
): Promise<CustomAgentConfigBundle | null> {
  const agent = await getCustomAgent(userId, agentId);
  if (!agent) return null;

  const [memories, skills, routines, integrations] = await Promise.all([
    db
      .select()
      .from(customAgentMemory)
      .where(eq(customAgentMemory.agentId, agentId))
      .orderBy(asc(customAgentMemory.createdAt)),
    db
      .select()
      .from(customAgentSkill)
      .where(eq(customAgentSkill.agentId, agentId))
      .orderBy(asc(customAgentSkill.title)),
    db
      .select()
      .from(customAgentRoutine)
      .where(eq(customAgentRoutine.agentId, agentId))
      .orderBy(asc(customAgentRoutine.name)),
    db
      .select()
      .from(customAgentIntegration)
      .where(eq(customAgentIntegration.agentId, agentId))
      .orderBy(asc(customAgentIntegration.connectionId)),
  ]);

  return {
    memories: memories.map(memoryView),
    skills: skills.map(skillView),
    routines: routines.map(routineView),
    integrations: integrations
      .map(integrationView)
      .filter((row): row is CustomAgentIntegrationView => row !== null),
  };
}

export async function listCustomAgentMemories(
  agentId: string,
): Promise<readonly CustomAgentMemoryView[]> {
  const rows = await db
    .select()
    .from(customAgentMemory)
    .where(eq(customAgentMemory.agentId, agentId))
    .orderBy(asc(customAgentMemory.createdAt));
  return rows.map(memoryView);
}

export async function listEnabledCustomAgentSkills(
  agentId: string,
): Promise<readonly CustomAgentSkillView[]> {
  const rows = await db
    .select()
    .from(customAgentSkill)
    .where(
      and(
        eq(customAgentSkill.agentId, agentId),
        eq(customAgentSkill.enabled, true),
      ),
    )
    .orderBy(asc(customAgentSkill.slug));
  return rows.map(skillView);
}

export async function listCustomAgentIntegrationIds(
  agentId: string,
): Promise<readonly AgentIntegrationId[]> {
  const rows = await db
    .select({ connectionId: customAgentIntegration.connectionId })
    .from(customAgentIntegration)
    .where(eq(customAgentIntegration.agentId, agentId));
  const ids: AgentIntegrationId[] = [];
  for (const row of rows) {
    if (isAgentIntegrationId(row.connectionId)) ids.push(row.connectionId);
  }
  return ids;
}

export async function addCustomAgentMemory(
  userId: string,
  agentId: string,
  text: string,
): Promise<CustomAgentMemoryView> {
  await requireOwnedAgent(userId, agentId);
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (!trimmed) throw new CustomAgentError("Memory text is required.");
  const [row] = await db
    .insert(customAgentMemory)
    .values({
      id: randomUUID(),
      agentId,
      text: trimmed.slice(0, MAX_MEMORY),
    })
    .returning();
  if (!row) throw new CustomAgentError("Failed to save memory.");
  return memoryView(row);
}

export async function updateCustomAgentMemory(
  userId: string,
  agentId: string,
  memoryId: string,
  text: string,
): Promise<CustomAgentMemoryView | null> {
  await requireOwnedAgent(userId, agentId);
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (!trimmed) throw new CustomAgentError("Memory text is required.");
  const [row] = await db
    .update(customAgentMemory)
    .set({ text: trimmed.slice(0, MAX_MEMORY), updatedAt: new Date() })
    .where(
      and(
        eq(customAgentMemory.id, memoryId),
        eq(customAgentMemory.agentId, agentId),
      ),
    )
    .returning();
  return row ? memoryView(row) : null;
}

export async function deleteCustomAgentMemory(
  userId: string,
  agentId: string,
  memoryId: string,
): Promise<boolean> {
  await requireOwnedAgent(userId, agentId);
  const deleted = await db
    .delete(customAgentMemory)
    .where(
      and(
        eq(customAgentMemory.id, memoryId),
        eq(customAgentMemory.agentId, agentId),
      ),
    )
    .returning({ id: customAgentMemory.id });
  return deleted.length > 0;
}

export async function upsertCustomAgentSkill(
  userId: string,
  agentId: string,
  input: {
    readonly id?: string;
    readonly slug: string;
    readonly title: string;
    readonly description: string;
    readonly markdown: string;
    readonly enabled?: boolean;
  },
): Promise<CustomAgentSkillView> {
  await requireOwnedAgent(userId, agentId);
  const slug = input.slug.trim().toLowerCase().replace(/\s+/g, "-").slice(0, 80);
  const title = input.title.trim().slice(0, 120);
  const description = input.description.trim().slice(0, 500);
  const markdown = input.markdown.slice(0, MAX_SKILL_MARKDOWN);
  if (!slug || !title || !description || !markdown.trim()) {
    throw new CustomAgentError("Skill needs a slug, title, description, and body.");
  }

  if (input.id) {
    const [row] = await db
      .update(customAgentSkill)
      .set({
        slug,
        title,
        description,
        markdown,
        enabled: input.enabled ?? true,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(customAgentSkill.id, input.id),
          eq(customAgentSkill.agentId, agentId),
        ),
      )
      .returning();
    if (!row) throw new CustomAgentError("Unknown skill.");
    return skillView(row);
  }

  const [row] = await db
    .insert(customAgentSkill)
    .values({
      id: randomUUID(),
      agentId,
      slug,
      title,
      description,
      markdown,
      enabled: input.enabled ?? true,
    })
    .returning();
  if (!row) throw new CustomAgentError("Failed to save skill.");
  return skillView(row);
}

export async function deleteCustomAgentSkill(
  userId: string,
  agentId: string,
  skillId: string,
): Promise<boolean> {
  await requireOwnedAgent(userId, agentId);
  const deleted = await db
    .delete(customAgentSkill)
    .where(
      and(
        eq(customAgentSkill.id, skillId),
        eq(customAgentSkill.agentId, agentId),
      ),
    )
    .returning({ id: customAgentSkill.id });
  return deleted.length > 0;
}

export async function upsertCustomAgentRoutine(
  userId: string,
  agentId: string,
  input: {
    readonly id?: string;
    readonly name: string;
    readonly cron: string;
    readonly timezone?: string;
    readonly prompt: string;
    readonly enabled?: boolean;
  },
): Promise<CustomAgentRoutineView> {
  await requireOwnedAgent(userId, agentId);
  const name = input.name.trim().slice(0, 120);
  const cron = input.cron.trim().slice(0, 64);
  const timezone = (input.timezone ?? "America/Los_Angeles").trim().slice(0, 64);
  const prompt = input.prompt.trim().slice(0, MAX_ROUTINE_PROMPT);
  if (!name || !cron || !prompt) {
    throw new CustomAgentError("Routine needs a name, cron, and prompt.");
  }

  if (input.id) {
    const [row] = await db
      .update(customAgentRoutine)
      .set({
        name,
        cron,
        timezone,
        prompt,
        enabled: input.enabled ?? true,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(customAgentRoutine.id, input.id),
          eq(customAgentRoutine.agentId, agentId),
        ),
      )
      .returning();
    if (!row) throw new CustomAgentError("Unknown routine.");
    return routineView(row);
  }

  const [row] = await db
    .insert(customAgentRoutine)
    .values({
      id: randomUUID(),
      agentId,
      name,
      cron,
      timezone,
      prompt,
      enabled: input.enabled ?? true,
    })
    .returning();
  if (!row) throw new CustomAgentError("Failed to save routine.");
  return routineView(row);
}

export async function deleteCustomAgentRoutine(
  userId: string,
  agentId: string,
  routineId: string,
): Promise<boolean> {
  await requireOwnedAgent(userId, agentId);
  const deleted = await db
    .delete(customAgentRoutine)
    .where(
      and(
        eq(customAgentRoutine.id, routineId),
        eq(customAgentRoutine.agentId, agentId),
      ),
    )
    .returning({ id: customAgentRoutine.id });
  return deleted.length > 0;
}

export async function setCustomAgentIntegrations(
  userId: string,
  agentId: string,
  connectionIds: readonly string[],
): Promise<readonly CustomAgentIntegrationView[]> {
  await requireOwnedAgent(userId, agentId);
  const unique = [
    ...new Set(
      connectionIds.filter(isAgentIntegrationId),
    ),
  ] as AgentIntegrationId[];

  await db.transaction(async (tx) => {
    await tx
      .delete(customAgentIntegration)
      .where(eq(customAgentIntegration.agentId, agentId));
    for (const connectionId of unique) {
      await tx.insert(customAgentIntegration).values({
        id: randomUUID(),
        agentId,
        connectionId,
      });
    }
  });

  const rows = await db
    .select()
    .from(customAgentIntegration)
    .where(eq(customAgentIntegration.agentId, agentId))
    .orderBy(asc(customAgentIntegration.connectionId));
  return rows
    .map(integrationView)
    .filter((row): row is CustomAgentIntegrationView => row !== null);
}

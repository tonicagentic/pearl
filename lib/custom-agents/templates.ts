import { and, asc, eq, isNotNull } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import {
  DEFAULT_AGENT_MARK_ACCENT,
  DEFAULT_AGENT_MARK_BROWS,
  DEFAULT_AGENT_MARK_GAZE,
  DEFAULT_AGENT_MARK_SHAPE,
  DEFAULT_AGENT_MARK_TALK,
  isAgentMarkBrows,
  isAgentMarkGaze,
  isAgentMarkShape,
  isAgentMarkTalk,
} from "@/lib/custom-agents/mark";
import {
  isAgentIntegrationId,
  type AgentIntegrationId,
} from "@/lib/custom-agents/integrations";
import {
  CustomAgentError,
  insertCustomAgentWithChat,
} from "@/lib/custom-agents/store";
import type {
  AgentTemplateDetail,
  AgentTemplateSummary,
} from "@/lib/custom-agents/template-types";
import type { CustomAgentSummary } from "@/lib/custom-agents/types";
import { db } from "@/lib/db/client";
import { getProject } from "@/lib/db/projects";
import {
  agentTemplate,
  chat,
  customAgent,
  customAgentIntegration,
  customAgentMemory,
  customAgentRoutine,
  customAgentSkill,
  type AgentTemplate,
} from "@/lib/db/schema";

function markFields(row: AgentTemplate) {
  return {
    accent: row.accent || DEFAULT_AGENT_MARK_ACCENT,
    markShape: isAgentMarkShape(row.markShape)
      ? row.markShape
      : DEFAULT_AGENT_MARK_SHAPE,
    markTalk: isAgentMarkTalk(row.markTalk)
      ? row.markTalk
      : DEFAULT_AGENT_MARK_TALK,
    markBrows: isAgentMarkBrows(row.markBrows)
      ? row.markBrows
      : DEFAULT_AGENT_MARK_BROWS,
    markGaze: isAgentMarkGaze(row.markGaze)
      ? row.markGaze
      : DEFAULT_AGENT_MARK_GAZE,
  };
}

function integrationIdsOf(
  row: AgentTemplate,
): readonly AgentIntegrationId[] {
  const ids: AgentIntegrationId[] = [];
  for (const entry of row.integrations ?? []) {
    if (entry?.connectionId && isAgentIntegrationId(entry.connectionId)) {
      ids.push(entry.connectionId);
    }
  }
  return ids;
}

function toSummary(
  row: AgentTemplate,
  added: { readonly agentId: string; readonly chatId: string } | null,
): AgentTemplateSummary {
  const mark = markFields(row);
  return {
    slug: row.slug,
    name: row.name,
    description: row.description,
    category: row.category,
    featured: row.featured,
    sortOrder: row.sortOrder,
    ...mark,
    memoryCount: row.memories?.length ?? 0,
    skillCount: row.skills?.length ?? 0,
    routineCount: row.routines?.length ?? 0,
    integrationIds: integrationIdsOf(row),
    addedAgentId: added?.agentId ?? null,
    addedChatId: added?.chatId ?? null,
  };
}

function toDetail(
  row: AgentTemplate,
  added: { readonly agentId: string; readonly chatId: string } | null,
): AgentTemplateDetail {
  const summary = toSummary(row, added);
  return {
    ...summary,
    instructions: row.instructions,
    memories: (row.memories ?? []).map((memory) => ({ text: memory.text })),
    skills: (row.skills ?? []).map((skill) => ({
      slug: skill.slug,
      title: skill.title,
      description: skill.description,
      markdown: skill.markdown,
    })),
    routines: (row.routines ?? []).map((routine) => ({
      name: routine.name,
      cron: routine.cron,
      timezone: routine.timezone,
      prompt: routine.prompt,
    })),
    integrations: integrationIdsOf(row).map((connectionId) => ({
      connectionId,
    })),
  };
}

async function addedBySlug(
  userId: string | null,
  projectId: string | null,
): Promise<Map<string, { readonly agentId: string; readonly chatId: string }>> {
  const map = new Map<
    string,
    { readonly agentId: string; readonly chatId: string }
  >();
  if (!userId || !projectId) return map;

  const rows = await db
    .select({
      slug: customAgent.templateSlug,
      agentId: customAgent.id,
      chatId: chat.id,
    })
    .from(customAgent)
    .innerJoin(chat, eq(chat.customAgentId, customAgent.id))
    .where(
      and(
        eq(customAgent.userId, userId),
        eq(customAgent.projectId, projectId),
        isNotNull(customAgent.templateSlug),
      ),
    );

  for (const row of rows) {
    if (row.slug) {
      map.set(row.slug, { agentId: row.agentId, chatId: row.chatId });
    }
  }
  return map;
}

export async function listAgentTemplates(
  userId: string | null,
  options?: { readonly projectId?: string | null },
): Promise<readonly AgentTemplateSummary[]> {
  const projectId = options?.projectId ?? null;
  const [rows, added] = await Promise.all([
    db.select().from(agentTemplate).orderBy(asc(agentTemplate.sortOrder)),
    addedBySlug(userId, projectId),
  ]);
  return rows.map((row) => toSummary(row, added.get(row.slug) ?? null));
}

export async function getAgentTemplate(
  slug: string,
  userId: string | null,
  options?: { readonly projectId?: string | null },
): Promise<AgentTemplateDetail | null> {
  const [row] = await db
    .select()
    .from(agentTemplate)
    .where(eq(agentTemplate.slug, slug))
    .limit(1);
  if (!row) return null;
  const added = await addedBySlug(userId, options?.projectId ?? null);
  return toDetail(row, added.get(row.slug) ?? null);
}

/**
 * Copy a directory template into a project as a member agent (idempotent per
 * project + template slug).
 */
export async function addAgentFromTemplate(
  userId: string,
  slug: string,
  projectId: string,
): Promise<CustomAgentSummary> {
  const owned = await getProject(userId, projectId);
  if (!owned) {
    throw new CustomAgentError("Unknown project.");
  }

  const template = await getAgentTemplate(slug, userId, { projectId });
  if (!template) {
    throw new CustomAgentError("Unknown agent template.");
  }

  if (template.addedAgentId && template.addedChatId) {
    const [row] = await db
      .select({
        agent: customAgent,
        chatId: chat.id,
        chatTitle: chat.title,
      })
      .from(customAgent)
      .innerJoin(chat, eq(chat.customAgentId, customAgent.id))
      .where(
        and(
          eq(customAgent.userId, userId),
          eq(customAgent.projectId, projectId),
          eq(customAgent.id, template.addedAgentId),
        ),
      )
      .limit(1);
    if (row) {
      return {
        id: row.agent.id,
        name: row.agent.name,
        instructions: row.agent.instructions,
        accent: row.agent.accent,
        markShape: isAgentMarkShape(row.agent.markShape)
          ? row.agent.markShape
          : DEFAULT_AGENT_MARK_SHAPE,
        markTalk: isAgentMarkTalk(row.agent.markTalk)
          ? row.agent.markTalk
          : DEFAULT_AGENT_MARK_TALK,
        markBrows: isAgentMarkBrows(row.agent.markBrows)
          ? row.agent.markBrows
          : DEFAULT_AGENT_MARK_BROWS,
        markGaze: isAgentMarkGaze(row.agent.markGaze)
          ? row.agent.markGaze
          : DEFAULT_AGENT_MARK_GAZE,
        projectId: row.agent.projectId,
        projectName: owned.name,
        role: row.agent.role === "manager" ? "manager" : "member",
        chatId: row.chatId,
        chatTitle: row.chatTitle,
        createdAt: row.agent.createdAt.toISOString(),
        updatedAt: row.agent.updatedAt.toISOString(),
      };
    }
  }

  const [raw] = await db
    .select()
    .from(agentTemplate)
    .where(eq(agentTemplate.slug, slug))
    .limit(1);
  if (!raw) {
    throw new CustomAgentError("Unknown agent template.");
  }

  const mark = markFields(raw);

  try {
    return await db.transaction(async (tx) => {
      const summary = await insertCustomAgentWithChat(tx, {
        userId,
        projectId,
        role: "member",
        name: raw.name,
        instructions: raw.instructions,
        accent: mark.accent,
        markShape: mark.markShape,
        markTalk: mark.markTalk,
        markBrows: mark.markBrows,
        markGaze: mark.markGaze,
        templateSlug: raw.slug,
      });

      const agentId = summary.id;

      for (const memory of raw.memories ?? []) {
        if (!memory.text?.trim()) continue;
        await tx.insert(customAgentMemory).values({
          id: randomUUID(),
          agentId,
          text: memory.text.trim().slice(0, 2000),
        });
      }
      for (const skill of raw.skills ?? []) {
        if (!skill.slug?.trim()) continue;
        await tx.insert(customAgentSkill).values({
          id: randomUUID(),
          agentId,
          slug: skill.slug.trim().slice(0, 80),
          title: skill.title.trim().slice(0, 120) || skill.slug,
          description: skill.description.trim().slice(0, 500),
          markdown: skill.markdown.slice(0, 50_000),
          enabled: true,
        });
      }
      for (const routine of raw.routines ?? []) {
        if (!routine.name?.trim() || !routine.cron?.trim()) continue;
        await tx.insert(customAgentRoutine).values({
          id: randomUUID(),
          agentId,
          name: routine.name.trim().slice(0, 120),
          cron: routine.cron.trim().slice(0, 64),
          timezone: (routine.timezone || "America/Los_Angeles").slice(0, 64),
          prompt: routine.prompt.slice(0, 20_000),
          enabled: true,
        });
      }
      for (const integration of raw.integrations ?? []) {
        if (
          !integration.connectionId ||
          !isAgentIntegrationId(integration.connectionId)
        ) {
          continue;
        }
        await tx.insert(customAgentIntegration).values({
          id: randomUUID(),
          agentId,
          connectionId: integration.connectionId,
        });
      }

      return summary;
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/unique|duplicate/i.test(message)) {
      const again = await getAgentTemplate(slug, userId, { projectId });
      if (again?.addedAgentId && again.addedChatId) {
        return addAgentFromTemplate(userId, slug, projectId);
      }
      throw new CustomAgentError(
        "This project already has an agent with that name. Rename it or pick another template.",
      );
    }
    throw error;
  }
}

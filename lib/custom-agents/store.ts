import { and, asc, eq, sql } from "drizzle-orm";
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
  type AgentMarkBrows,
  type AgentMarkGaze,
  type AgentMarkShape,
  type AgentMarkTalk,
} from "@/lib/custom-agents/mark";
import type {
  CustomAgentRef,
  CustomAgentRole,
  CustomAgentSummary,
} from "@/lib/custom-agents/types";
import { db } from "@/lib/db/client";
import {
  chat,
  customAgent,
  project,
  type CustomAgent,
} from "@/lib/db/schema";

const MAX_NAME = 80;
const MAX_INSTRUCTIONS = 20_000;
const ACCENT_PATTERN = /^#[0-9A-Fa-f]{6}$/;

export const DEFAULT_MANAGER_NAME = "Project Manager";

export const DEFAULT_MANAGER_INSTRUCTIONS =
  "You are the project manager for this project. Build lasting context about the work, keep skills and routines current, and run scheduled check-ins. Prefer project goals, notes, and files when deciding what matters.";

export class CustomAgentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CustomAgentError";
  }
}

type DbOrTx = Pick<typeof db, "insert" | "select" | "update" | "delete">;

function requireName(raw: string): string {
  const name = raw.replace(/\s+/g, " ").trim();
  if (!name) {
    throw new CustomAgentError("An agent needs a name.");
  }
  if (name.length > MAX_NAME) {
    throw new CustomAgentError(
      `Agent names must be ${MAX_NAME} characters or fewer.`,
    );
  }
  return name;
}

function normalizeInstructions(raw: string | undefined): string {
  return (raw ?? "").slice(0, MAX_INSTRUCTIONS);
}

function normalizeAccent(raw: string | undefined): string {
  const accent = (raw ?? DEFAULT_AGENT_MARK_ACCENT).trim();
  if (!ACCENT_PATTERN.test(accent)) {
    throw new CustomAgentError("Accent must be a hex color like #2DD4BF.");
  }
  return accent.toUpperCase();
}

function normalizeMarkShape(raw: string | undefined): AgentMarkShape {
  if (raw === undefined || raw === "") return DEFAULT_AGENT_MARK_SHAPE;
  if (!isAgentMarkShape(raw)) {
    throw new CustomAgentError(
      "Mark shape must be oval, diamond, square, or trap.",
    );
  }
  return raw;
}

function normalizeMarkTalk(raw: string | undefined): AgentMarkTalk {
  if (raw === undefined || raw === "") return DEFAULT_AGENT_MARK_TALK;
  if (!isAgentMarkTalk(raw)) {
    throw new CustomAgentError(
      "Mark talk must be hinge, lift, or chatter.",
    );
  }
  return raw;
}

function normalizeMarkBrows(raw: string | undefined): AgentMarkBrows {
  if (raw === undefined || raw === "") return DEFAULT_AGENT_MARK_BROWS;
  if (!isAgentMarkBrows(raw)) {
    throw new CustomAgentError("Mark brows must be none or line.");
  }
  return raw;
}

function normalizeMarkGaze(raw: string | undefined): AgentMarkGaze {
  if (raw === undefined || raw === "") return DEFAULT_AGENT_MARK_GAZE;
  if (!isAgentMarkGaze(raw)) {
    throw new CustomAgentError("Mark gaze must be still or wander.");
  }
  return raw;
}

function markShapeOf(agent: CustomAgent): AgentMarkShape {
  return isAgentMarkShape(agent.markShape)
    ? agent.markShape
    : DEFAULT_AGENT_MARK_SHAPE;
}

function markTalkOf(agent: CustomAgent): AgentMarkTalk {
  return isAgentMarkTalk(agent.markTalk)
    ? agent.markTalk
    : DEFAULT_AGENT_MARK_TALK;
}

function markBrowsOf(agent: CustomAgent): AgentMarkBrows {
  return isAgentMarkBrows(agent.markBrows)
    ? agent.markBrows
    : DEFAULT_AGENT_MARK_BROWS;
}

function markGazeOf(agent: CustomAgent): AgentMarkGaze {
  return isAgentMarkGaze(agent.markGaze)
    ? agent.markGaze
    : DEFAULT_AGENT_MARK_GAZE;
}

function roleOf(agent: CustomAgent): CustomAgentRole {
  return agent.role === "manager" ? "manager" : "member";
}

function toSummary(
  agent: CustomAgent,
  chatId: string,
  chatTitle: string,
  projectName: string | null,
): CustomAgentSummary {
  return {
    id: agent.id,
    name: agent.name,
    instructions: agent.instructions,
    accent: agent.accent,
    markShape: markShapeOf(agent),
    markTalk: markTalkOf(agent),
    markBrows: markBrowsOf(agent),
    markGaze: markGazeOf(agent),
    projectId: agent.projectId,
    projectName,
    role: roleOf(agent),
    chatId,
    chatTitle,
    createdAt: agent.createdAt.toISOString(),
    updatedAt: agent.updatedAt.toISOString(),
  };
}

function toRef(agent: CustomAgent): CustomAgentRef {
  return {
    id: agent.id,
    name: agent.name,
    accent: agent.accent,
    markShape: markShapeOf(agent),
    markTalk: markTalkOf(agent),
    markBrows: markBrowsOf(agent),
    markGaze: markGazeOf(agent),
    instructions: agent.instructions,
  };
}

async function assertOwnedProject(
  executor: DbOrTx,
  userId: string,
  projectId: string,
): Promise<{ readonly id: string; readonly name: string }> {
  const [row] = await executor
    .select({ id: project.id, name: project.name })
    .from(project)
    .where(and(eq(project.userId, userId), eq(project.id, projectId)))
    .limit(1);
  if (!row) {
    throw new CustomAgentError("Unknown project.");
  }
  return row;
}

/**
 * Insert a custom agent + durable chat. Used by createCustomAgent and
 * createProject (manager). Caller owns the transaction when needed.
 */
export async function insertCustomAgentWithChat(
  executor: DbOrTx,
  input: {
    readonly userId: string;
    readonly projectId: string;
    readonly role: CustomAgentRole;
    readonly name: string;
    readonly instructions: string;
    readonly accent: string;
    readonly markShape: AgentMarkShape;
    readonly markTalk: AgentMarkTalk;
    readonly markBrows: AgentMarkBrows;
    readonly markGaze: AgentMarkGaze;
    readonly templateSlug?: string | null;
  },
): Promise<CustomAgentSummary> {
  const agentId = randomUUID();
  const chatId = randomUUID();

  const [agent] = await executor
    .insert(customAgent)
    .values({
      id: agentId,
      userId: input.userId,
      projectId: input.projectId,
      role: input.role,
      name: input.name,
      instructions: input.instructions,
      accent: input.accent,
      markShape: input.markShape,
      markTalk: input.markTalk,
      markBrows: input.markBrows,
      markGaze: input.markGaze,
      templateSlug: input.templateSlug ?? null,
    })
    .returning();
  if (!agent) {
    throw new CustomAgentError("Failed to create agent.");
  }

  const [chatRow] = await executor
    .insert(chat)
    .values({
      id: chatId,
      userId: input.userId,
      title: input.name,
      projectId: input.projectId,
      customAgentId: agentId,
    })
    .returning({ id: chat.id, title: chat.title });
  if (!chatRow) {
    throw new CustomAgentError("Failed to create agent thread.");
  }

  const [proj] = await executor
    .select({ name: project.name })
    .from(project)
    .where(eq(project.id, input.projectId))
    .limit(1);

  return toSummary(agent, chatRow.id, chatRow.title, proj?.name ?? null);
}

/** Create the one manager agent for a project (call inside createProject tx). */
export async function insertProjectManager(
  executor: DbOrTx,
  userId: string,
  projectId: string,
): Promise<CustomAgentSummary> {
  return insertCustomAgentWithChat(executor, {
    userId,
    projectId,
    role: "manager",
    name: DEFAULT_MANAGER_NAME,
    instructions: DEFAULT_MANAGER_INSTRUCTIONS,
    accent: DEFAULT_AGENT_MARK_ACCENT,
    markShape: DEFAULT_AGENT_MARK_SHAPE,
    markTalk: DEFAULT_AGENT_MARK_TALK,
    markBrows: DEFAULT_AGENT_MARK_BROWS,
    markGaze: DEFAULT_AGENT_MARK_GAZE,
  });
}

export async function listCustomAgents(
  userId: string,
  options?: { readonly projectId?: string },
): Promise<readonly CustomAgentSummary[]> {
  const rows = await db
    .select({
      agent: customAgent,
      chatId: chat.id,
      chatTitle: chat.title,
      projectName: project.name,
    })
    .from(customAgent)
    .innerJoin(chat, eq(chat.customAgentId, customAgent.id))
    .innerJoin(project, eq(project.id, customAgent.projectId))
    .where(
      options?.projectId
        ? and(
            eq(customAgent.userId, userId),
            eq(customAgent.projectId, options.projectId),
          )
        : eq(customAgent.userId, userId),
    )
    .orderBy(asc(project.name), asc(customAgent.role), asc(customAgent.name));

  return rows.map((row) =>
    toSummary(row.agent, row.chatId, row.chatTitle, row.projectName),
  );
}

export async function getCustomAgent(
  userId: string,
  agentId: string,
): Promise<CustomAgentSummary | null> {
  const [row] = await db
    .select({
      agent: customAgent,
      chatId: chat.id,
      chatTitle: chat.title,
      projectName: project.name,
    })
    .from(customAgent)
    .innerJoin(chat, eq(chat.customAgentId, customAgent.id))
    .innerJoin(project, eq(project.id, customAgent.projectId))
    .where(and(eq(customAgent.userId, userId), eq(customAgent.id, agentId)))
    .limit(1);
  if (!row) return null;
  return toSummary(row.agent, row.chatId, row.chatTitle, row.projectName);
}

export async function getCustomAgentRefForChat(
  userId: string,
  chatId: string,
): Promise<CustomAgentRef | null> {
  const [row] = await db
    .select({ agent: customAgent })
    .from(chat)
    .innerJoin(customAgent, eq(customAgent.id, chat.customAgentId))
    .where(and(eq(chat.id, chatId), eq(chat.userId, userId)))
    .limit(1);
  return row ? toRef(row.agent) : null;
}

/** Resolve a custom agent by its durable chat id (for instruction injection). */
export async function getCustomAgentByChatId(
  userId: string,
  chatId: string,
): Promise<CustomAgent | null> {
  const [row] = await db
    .select({ agent: customAgent })
    .from(chat)
    .innerJoin(customAgent, eq(customAgent.id, chat.customAgentId))
    .where(and(eq(chat.id, chatId), eq(chat.userId, userId)))
    .limit(1);
  return row?.agent ?? null;
}

/**
 * Resolve via eve session id → chat → custom agent. Works after the chat
 * row has an eveSession (follow-up turns); first turn still needs chatId.
 */
export async function getCustomAgentByEveSessionId(
  userId: string,
  sessionId: string,
): Promise<CustomAgent | null> {
  const trimmed = sessionId.trim();
  if (!trimmed) return null;
  const [row] = await db
    .select({ agent: customAgent })
    .from(chat)
    .innerJoin(customAgent, eq(customAgent.id, chat.customAgentId))
    .where(
      and(
        eq(chat.userId, userId),
        sql`${chat.eveSession} ->> 'sessionId' = ${trimmed}`,
      ),
    )
    .limit(1);
  return row?.agent ?? null;
}

/**
 * Resolve by agent id only when the signed-in user owns it and the agent
 * still has its durable chat. Used when the client sends eveCustomAgentId.
 */
export async function getOwnedCustomAgent(
  userId: string,
  agentId: string,
): Promise<CustomAgent | null> {
  const [row] = await db
    .select({ agent: customAgent })
    .from(customAgent)
    .innerJoin(chat, eq(chat.customAgentId, customAgent.id))
    .where(and(eq(customAgent.userId, userId), eq(customAgent.id, agentId)))
    .limit(1);
  return row?.agent ?? null;
}

/**
 * Create a member custom agent and its durable chat in a project.
 */
export async function createCustomAgent(
  userId: string,
  input: {
    readonly projectId: string;
    readonly name: string;
    readonly instructions?: string;
    readonly accent?: string;
    readonly markShape?: string;
    readonly markTalk?: string;
    readonly markBrows?: string;
    readonly markGaze?: string;
    readonly templateSlug?: string | null;
    readonly role?: CustomAgentRole;
  },
): Promise<CustomAgentSummary> {
  const projectId = input.projectId.trim();
  if (!projectId) {
    throw new CustomAgentError("An agent needs a project.");
  }
  await assertOwnedProject(db, userId, projectId);

  const name = requireName(input.name);
  const instructions = normalizeInstructions(input.instructions);
  const accent = normalizeAccent(input.accent);
  const markShape = normalizeMarkShape(input.markShape);
  const markTalk = normalizeMarkTalk(input.markTalk);
  const markBrows = normalizeMarkBrows(input.markBrows);
  const markGaze = normalizeMarkGaze(input.markGaze);
  const templateSlug = input.templateSlug?.trim() || null;
  const role: CustomAgentRole = input.role === "manager" ? "manager" : "member";

  try {
    return await db.transaction(async (tx) =>
      insertCustomAgentWithChat(tx, {
        userId,
        projectId,
        role,
        name,
        instructions,
        accent,
        markShape,
        markTalk,
        markBrows,
        markGaze,
        templateSlug,
      }),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/unique|duplicate/i.test(message)) {
      throw new CustomAgentError(
        "This project already has an agent with that name.",
      );
    }
    throw error;
  }
}

export async function updateCustomAgent(
  userId: string,
  agentId: string,
  input: {
    readonly name?: string;
    readonly instructions?: string;
    readonly accent?: string;
    readonly markShape?: string;
    readonly markTalk?: string;
    readonly markBrows?: string;
    readonly markGaze?: string;
  },
): Promise<CustomAgentSummary | null> {
  const existing = await getCustomAgent(userId, agentId);
  if (!existing) return null;

  const name =
    input.name !== undefined ? requireName(input.name) : existing.name;
  const instructions =
    input.instructions !== undefined
      ? normalizeInstructions(input.instructions)
      : existing.instructions;
  const accent =
    input.accent !== undefined
      ? normalizeAccent(input.accent)
      : existing.accent;
  const markShape =
    input.markShape !== undefined
      ? normalizeMarkShape(input.markShape)
      : existing.markShape;
  const markTalk =
    input.markTalk !== undefined
      ? normalizeMarkTalk(input.markTalk)
      : existing.markTalk;
  const markBrows =
    input.markBrows !== undefined
      ? normalizeMarkBrows(input.markBrows)
      : existing.markBrows;
  const markGaze =
    input.markGaze !== undefined
      ? normalizeMarkGaze(input.markGaze)
      : existing.markGaze;

  try {
    const [agent] = await db
      .update(customAgent)
      .set({
        name,
        instructions,
        accent,
        markShape,
        markTalk,
        markBrows,
        markGaze,
        updatedAt: new Date(),
      })
      .where(and(eq(customAgent.userId, userId), eq(customAgent.id, agentId)))
      .returning();
    if (!agent) return null;

    let chatTitle = existing.chatTitle;
    if (name !== existing.name) {
      await db
        .update(chat)
        .set({ title: name, updatedAt: new Date() })
        .where(and(eq(chat.customAgentId, agentId), eq(chat.userId, userId)));
      chatTitle = name;
    }

    return toSummary(agent, existing.chatId, chatTitle, existing.projectName);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/unique|duplicate/i.test(message)) {
      throw new CustomAgentError(
        "This project already has an agent with that name.",
      );
    }
    throw error;
  }
}

/** Deletes the agent; cascade removes its chat and events. Managers stay. */
export async function deleteCustomAgent(
  userId: string,
  agentId: string,
): Promise<boolean> {
  const existing = await getCustomAgent(userId, agentId);
  if (!existing) return false;
  if (existing.role === "manager") {
    throw new CustomAgentError(
      "The project manager cannot be deleted. Delete the project instead.",
    );
  }
  const deleted = await db
    .delete(customAgent)
    .where(and(eq(customAgent.userId, userId), eq(customAgent.id, agentId)))
    .returning({ id: customAgent.id });
  return deleted.length > 0;
}

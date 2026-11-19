import { and, asc, eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import type {
  CustomAgentRef,
  CustomAgentSummary,
} from "@/lib/custom-agents/types";
import { db } from "@/lib/db/client";
import {
  chat,
  customAgent,
  type CustomAgent,
} from "@/lib/db/schema";

const MAX_NAME = 80;
const MAX_INSTRUCTIONS = 20_000;
const DEFAULT_ACCENT = "#2DD4BF";
const ACCENT_PATTERN = /^#[0-9A-Fa-f]{6}$/;

export class CustomAgentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CustomAgentError";
  }
}

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
  const accent = (raw ?? DEFAULT_ACCENT).trim();
  if (!ACCENT_PATTERN.test(accent)) {
    throw new CustomAgentError("Accent must be a hex color like #2DD4BF.");
  }
  return accent.toUpperCase();
}

function toSummary(
  agent: CustomAgent,
  chatId: string,
): CustomAgentSummary {
  return {
    id: agent.id,
    name: agent.name,
    instructions: agent.instructions,
    accent: agent.accent,
    chatId,
    createdAt: agent.createdAt.toISOString(),
    updatedAt: agent.updatedAt.toISOString(),
  };
}

function toRef(agent: CustomAgent): CustomAgentRef {
  return {
    id: agent.id,
    name: agent.name,
    accent: agent.accent,
    instructions: agent.instructions,
  };
}

export async function listCustomAgents(
  userId: string,
): Promise<readonly CustomAgentSummary[]> {
  const rows = await db
    .select({
      agent: customAgent,
      chatId: chat.id,
    })
    .from(customAgent)
    .innerJoin(chat, eq(chat.customAgentId, customAgent.id))
    .where(eq(customAgent.userId, userId))
    .orderBy(asc(customAgent.name));

  return rows.map((row) => toSummary(row.agent, row.chatId));
}

export async function getCustomAgent(
  userId: string,
  agentId: string,
): Promise<CustomAgentSummary | null> {
  const [row] = await db
    .select({
      agent: customAgent,
      chatId: chat.id,
    })
    .from(customAgent)
    .innerJoin(chat, eq(chat.customAgentId, customAgent.id))
    .where(and(eq(customAgent.userId, userId), eq(customAgent.id, agentId)))
    .limit(1);
  if (!row) return null;
  return toSummary(row.agent, row.chatId);
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
 * Create a custom agent and its one durable chat in a single transaction.
 */
export async function createCustomAgent(
  userId: string,
  input: {
    readonly name: string;
    readonly instructions?: string;
    readonly accent?: string;
  },
): Promise<CustomAgentSummary> {
  const name = requireName(input.name);
  const instructions = normalizeInstructions(input.instructions);
  const accent = normalizeAccent(input.accent);
  const agentId = randomUUID();
  const chatId = randomUUID();

  const summary = await db.transaction(async (tx) => {
    const [agent] = await tx
      .insert(customAgent)
      .values({
        id: agentId,
        userId,
        name,
        instructions,
        accent,
      })
      .returning();
    if (!agent) {
      throw new CustomAgentError("Failed to create agent.");
    }

    const [chatRow] = await tx
      .insert(chat)
      .values({
        id: chatId,
        userId,
        title: name,
        customAgentId: agentId,
      })
      .returning({ id: chat.id });
    if (!chatRow) {
      throw new CustomAgentError("Failed to create agent thread.");
    }

    return toSummary(agent, chatRow.id);
  });

  return summary;
}

export async function updateCustomAgent(
  userId: string,
  agentId: string,
  input: {
    readonly name?: string;
    readonly instructions?: string;
    readonly accent?: string;
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

  const [agent] = await db
    .update(customAgent)
    .set({
      name,
      instructions,
      accent,
      updatedAt: new Date(),
    })
    .where(and(eq(customAgent.userId, userId), eq(customAgent.id, agentId)))
    .returning();
  if (!agent) return null;

  // Keep the durable thread title aligned with the agent name.
  if (name !== existing.name) {
    await db
      .update(chat)
      .set({ title: name, updatedAt: new Date() })
      .where(and(eq(chat.customAgentId, agentId), eq(chat.userId, userId)));
  }

  return toSummary(agent, existing.chatId);
}

/** Deletes the agent; cascade removes its chat and events. */
export async function deleteCustomAgent(
  userId: string,
  agentId: string,
): Promise<boolean> {
  const deleted = await db
    .delete(customAgent)
    .where(and(eq(customAgent.userId, userId), eq(customAgent.id, agentId)))
    .returning({ id: customAgent.id });
  return deleted.length > 0;
}

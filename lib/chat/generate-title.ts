import { gateway } from "@ai-sdk/gateway";
import { generateText } from "ai";
import { and, eq } from "drizzle-orm";
import type { SessionStreamEvent } from "eve/client";

import {
  createFallbackTitle,
  DEFAULT_CHAT_TITLE,
  sanitizeChatTitle,
} from "@/lib/chat/title";
import { db } from "@/lib/db/client";
import { updateChatTitleForUser } from "@/lib/db/queries";
import { chat } from "@/lib/db/schema";

function aiConfigured() {
  return Boolean(
    process.env.AI_GATEWAY_API_KEY?.trim() ||
      process.env.VERCEL_OIDC_TOKEN?.trim() ||
      process.env.VERCEL === "1",
  );
}

/**
 * True when the stored title is still machine-owned (default or the first-message
 * fallback) — not a user rename or a prior LLM upgrade.
 */
export function isAutoTitle(title: string, firstUserText: string): boolean {
  if (title === DEFAULT_CHAT_TITLE) return true;
  const seed = firstUserText.trim();
  if (!seed) return false;
  return title === createFallbackTitle(seed);
}

/** Strip quotes / trailing punctuation fluff from a model title, then cap. */
export function sanitizeGeneratedTitle(raw: string): string {
  let next = raw.replace(/\s+/g, " ").trim();
  // Drop wrapping quotes / backticks the model sometimes adds.
  next = next.replace(/^["'`]+|["'`]+$/g, "").trim();
  // Drop a trailing period or ellipsis when the whole title is short.
  next = next.replace(/[.。…]+$/u, "").trim();
  return sanitizeChatTitle(next);
}

function textFromParts(parts: unknown): string {
  if (!Array.isArray(parts)) return "";
  const chunks: string[] = [];
  for (const part of parts) {
    if (!part || typeof part !== "object") continue;
    const text = (part as { text?: unknown }).text;
    if (typeof text === "string" && text.trim()) chunks.push(text);
  }
  return chunks.join("\n").trim();
}

/**
 * First user message text from a durable event snapshot
 * (`delivery.consumed` parts), if any.
 */
export function firstUserTextFromEvents(
  events: readonly SessionStreamEvent[],
): string | null {
  for (const event of events) {
    if (event.type !== "delivery.consumed") continue;
    const data = (event as { data?: { parts?: unknown } }).data;
    const text = textFromParts(data?.parts);
    if (text) return text;
  }
  return null;
}

export async function generateChatTitleFromMessage(
  text: string,
): Promise<string | null> {
  const seed = text.trim();
  if (!seed || !aiConfigured()) return null;

  try {
    const result = await generateText({
      model: gateway("openai/gpt-5-mini"),
      prompt: `Write a short chat title for this user message.

Rules:
- 3 to 6 words
- No quotation marks
- No trailing punctuation
- Title Case is fine
- English unless the message is clearly another language
- Return only the title text, nothing else

User message:
${seed.slice(0, 500)}`,
    });

    const title = sanitizeGeneratedTitle(result.text ?? "");
    if (!title || title === DEFAULT_CHAT_TITLE) return null;
    return title;
  } catch {
    return null;
  }
}

/**
 * Upgrade a chat title once when it is still the default / first-message
 * fallback. Never throws — callers keep the fallback on failure.
 */
export async function maybeUpgradeChatTitle(input: {
  readonly chatId: string;
  readonly userId: string;
  readonly firstUserText: string;
}): Promise<string | undefined> {
  const seed = input.firstUserText.trim();
  if (!seed || !aiConfigured()) return undefined;

  try {
    const [row] = await db
      .select({ title: chat.title })
      .from(chat)
      .where(and(eq(chat.id, input.chatId), eq(chat.userId, input.userId)))
      .limit(1);

    if (!row || !isAutoTitle(row.title, seed)) return undefined;

    const generated = await generateChatTitleFromMessage(seed);
    if (!generated || generated === row.title) return undefined;

    // Re-check ownership gate right before write in case the user renamed mid-flight.
    const [fresh] = await db
      .select({ title: chat.title })
      .from(chat)
      .where(and(eq(chat.id, input.chatId), eq(chat.userId, input.userId)))
      .limit(1);
    if (!fresh || !isAutoTitle(fresh.title, seed)) return undefined;

    const updated = await updateChatTitleForUser(
      input.chatId,
      input.userId,
      generated,
    );
    return updated?.title;
  } catch {
    return undefined;
  }
}

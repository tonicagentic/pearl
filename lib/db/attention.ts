import { eq } from "drizzle-orm";

import {
  ATTENTION_FRESH_MS,
  type AttentionSnapshot,
  type AttentionState,
  type AttentionSurface,
} from "@/lib/attention/filter-alert-tokens";
import { db } from "@/lib/db/client";
import { clientAttention } from "@/lib/db/schema";

export type UpsertClientAttentionInput = {
  readonly userId: string;
  readonly surface: AttentionSurface;
  readonly clientKey: string;
  readonly state: AttentionState;
  readonly chatId?: string | null;
  readonly sessionId?: string | null;
};

/**
 * Upsert the live-viewer row for one client. Mobile uses the Expo push
 * token as clientKey; web uses a stable per-tab id.
 */
export async function upsertClientAttention(
  input: UpsertClientAttentionInput,
): Promise<void> {
  const clientKey = input.clientKey.trim();
  if (!clientKey) {
    throw new Error("clientKey is required.");
  }
  if (input.surface !== "mobile" && input.surface !== "web") {
    throw new Error("surface must be mobile or web.");
  }
  if (input.state !== "active" && input.state !== "background") {
    throw new Error("state must be active or background.");
  }

  const chatId =
    typeof input.chatId === "string" && input.chatId.trim()
      ? input.chatId.trim()
      : null;
  const sessionId =
    typeof input.sessionId === "string" && input.sessionId.trim()
      ? input.sessionId.trim()
      : null;
  const now = new Date();

  await db
    .insert(clientAttention)
    .values({
      userId: input.userId,
      surface: input.surface,
      clientKey,
      state: input.state,
      chatId,
      sessionId,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [
        clientAttention.userId,
        clientAttention.surface,
        clientAttention.clientKey,
      ],
      set: {
        state: input.state,
        chatId,
        sessionId,
        updatedAt: now,
      },
    });
}

/**
 * All attention rows for a user. Callers apply freshness via
 * filterAlertPushTokens; we still prune obviously stale rows older than
 * several freshness windows so the table does not grow forever.
 */
export async function listClientAttentionForUser(
  userId: string,
): Promise<AttentionSnapshot[]> {
  const rows = await db
    .select({
      surface: clientAttention.surface,
      clientKey: clientAttention.clientKey,
      state: clientAttention.state,
      chatId: clientAttention.chatId,
      sessionId: clientAttention.sessionId,
      updatedAt: clientAttention.updatedAt,
    })
    .from(clientAttention)
    .where(eq(clientAttention.userId, userId));

  const pruneBefore = Date.now() - ATTENTION_FRESH_MS * 4;
  return rows
    .filter((row) => row.updatedAt.getTime() >= pruneBefore)
    .flatMap((row) => {
      if (row.surface !== "mobile" && row.surface !== "web") {
        return [];
      }
      if (row.state !== "active" && row.state !== "background") {
        return [];
      }
      return [
        {
          surface: row.surface,
          clientKey: row.clientKey,
          state: row.state,
          chatId: row.chatId,
          sessionId: row.sessionId,
          updatedAt: row.updatedAt,
        } satisfies AttentionSnapshot,
      ];
    });
}

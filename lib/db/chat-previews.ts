import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { getChatIdByEveSessionId } from "@/lib/db/queries";
import { chat } from "@/lib/db/schema";
import { mergeComputerPreviews } from "@/lib/workbench/previews";
import type { WorkbenchPreview } from "@/lib/workbench/types";

export async function getChatPreviews(
  chatId: string,
): Promise<readonly WorkbenchPreview[]> {
  const [row] = await db
    .select({ previews: chat.previews })
    .from(chat)
    .where(eq(chat.id, chatId))
    .limit(1);
  return row?.previews ?? [];
}

export async function upsertChatPreview(
  chatId: string,
  preview: WorkbenchPreview,
): Promise<readonly WorkbenchPreview[]> {
  const current = await getChatPreviews(chatId);
  const next = mergeComputerPreviews(current, preview);
  await db
    .update(chat)
    .set({ previews: [...next], updatedAt: new Date() })
    .where(eq(chat.id, chatId));
  return next;
}

export async function upsertChatPreviewForSession(
  sessionId: string,
  preview: WorkbenchPreview,
): Promise<readonly WorkbenchPreview[] | null> {
  const chatId = await getChatIdByEveSessionId(sessionId);
  if (!chatId) return null;
  return upsertChatPreview(chatId, preview);
}

export async function clearChatPreviews(chatId: string): Promise<void> {
  await db
    .update(chat)
    .set({ previews: [], updatedAt: new Date() })
    .where(eq(chat.id, chatId));
}

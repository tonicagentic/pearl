import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { plaidItemIndex } from "@/lib/db/schema";

/** Record that this Plaid item belongs to the signed-in user (main DB). */
export async function upsertPlaidItemIndex(input: {
  itemId: string;
  userId: string;
}) {
  await db
    .insert(plaidItemIndex)
    .values({
      itemId: input.itemId,
      userId: input.userId,
    })
    .onConflictDoUpdate({
      target: plaidItemIndex.itemId,
      set: { userId: input.userId },
    });
}

export async function deletePlaidItemIndex(itemId: string) {
  await db.delete(plaidItemIndex).where(eq(plaidItemIndex.itemId, itemId));
}

export async function findUserIdForPlaidItem(
  itemId: string,
): Promise<string | null> {
  const rows = await db
    .select({ userId: plaidItemIndex.userId })
    .from(plaidItemIndex)
    .where(eq(plaidItemIndex.itemId, itemId))
    .limit(1);
  return rows[0]?.userId ?? null;
}

/** Distinct Pearl user ids that currently have at least one linked Plaid item. */
export async function listPlaidFinanceUserIds(): Promise<string[]> {
  const rows = await db
    .selectDistinct({ userId: plaidItemIndex.userId })
    .from(plaidItemIndex);
  return rows.map((r) => r.userId);
}

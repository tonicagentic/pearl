import { deleteTokenCacheEntry, revokeToken } from "@vercel/connect";
import { eq } from "drizzle-orm";

import {
  CONNECTION_IDS,
  connectionConfiguration,
  connectionSubjectForUser,
} from "@/lib/connections/catalog";
import { db } from "@/lib/db/client";
import { user } from "@/lib/db/schema";

/**
 * Revoke Connect grants, then delete the better-auth user row. Cascades clear
 * chats, issues, projects, skills, billing rows, and related data.
 */
export async function deleteUserAccount(userId: string): Promise<void> {
  const subject = connectionSubjectForUser(userId);

  for (const id of CONNECTION_IDS) {
    const config = connectionConfiguration(id);
    if (!config.connector) {
      continue;
    }
    try {
      await revokeToken(config.connector, { subject });
      deleteTokenCacheEntry(config.connector, { subject });
    } catch {
      // Best-effort: a missing grant or Connect outage must not block deletion.
    }
  }

  await db.delete(user).where(eq(user.id, userId));
}

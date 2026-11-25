import { eq } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import {
  agentAttachment,
  area,
  billingAccount,
  chat,
  clientAttention,
  conceptSchema,
  conceptSchemaRevision,
  devicePushToken,
  icloudCalendarAccount,
  issue,
  mailAccount,
  mailRule,
  miniApp,
  project,
  projectArtifact,
  projectGoal,
  projectNote,
  usageEvent,
  usageReservation,
  userProfile,
  userSkill,
  workbenchPin,
} from "@/lib/db/schema";

/**
 * Move guest-owned rows onto the real account before better-auth deletes the
 * anonymous user. Skip `session` and `account` — those stay with each identity.
 *
 * No `db.transaction(...)`: the neon-http driver (production) does not support
 * interactive transactions ("No transactions support in neon-http driver").
 * Use `neon-http`'s atomic `batch()` when available, otherwise run sequentially.
 */
export async function reassignAnonymousUserData(input: {
  readonly fromUserId: string;
  readonly toUserId: string;
}): Promise<void> {
  const { fromUserId, toUserId } = input;
  if (fromUserId === toUserId) {
    return;
  }

  const database = getDb();
  const operations = [
    database
      .update(chat)
      .set({ userId: toUserId })
      .where(eq(chat.userId, fromUserId)),
    database
      .update(agentAttachment)
      .set({ userId: toUserId })
      .where(eq(agentAttachment.userId, fromUserId)),
    database
      .update(area)
      .set({ userId: toUserId })
      .where(eq(area.userId, fromUserId)),
    database
      .update(issue)
      .set({ userId: toUserId })
      .where(eq(issue.userId, fromUserId)),
    database
      .update(miniApp)
      .set({ userId: toUserId })
      .where(eq(miniApp.userId, fromUserId)),
    database
      .update(userSkill)
      .set({ userId: toUserId })
      .where(eq(userSkill.userId, fromUserId)),
    database
      .update(project)
      .set({ userId: toUserId })
      .where(eq(project.userId, fromUserId)),
    database
      .update(projectGoal)
      .set({ userId: toUserId })
      .where(eq(projectGoal.userId, fromUserId)),
    database
      .update(projectNote)
      .set({ userId: toUserId })
      .where(eq(projectNote.userId, fromUserId)),
    database
      .update(projectArtifact)
      .set({ userId: toUserId })
      .where(eq(projectArtifact.userId, fromUserId)),
    database
      .update(devicePushToken)
      .set({ userId: toUserId })
      .where(eq(devicePushToken.userId, fromUserId)),
    database
      .update(clientAttention)
      .set({ userId: toUserId })
      .where(eq(clientAttention.userId, fromUserId)),
    database
      .update(usageEvent)
      .set({ userId: toUserId })
      .where(eq(usageEvent.userId, fromUserId)),
    database
      .update(usageReservation)
      .set({ userId: toUserId })
      .where(eq(usageReservation.userId, fromUserId)),
    database
      .update(conceptSchema)
      .set({ userId: toUserId })
      .where(eq(conceptSchema.userId, fromUserId)),
    database
      .update(conceptSchemaRevision)
      .set({ userId: toUserId })
      .where(eq(conceptSchemaRevision.userId, fromUserId)),
    database
      .update(workbenchPin)
      .set({ userId: toUserId })
      .where(eq(workbenchPin.userId, fromUserId)),
    database
      .update(mailAccount)
      .set({ userId: toUserId })
      .where(eq(mailAccount.userId, fromUserId)),
    database
      .update(mailRule)
      .set({ userId: toUserId })
      .where(eq(mailRule.userId, fromUserId)),
    database
      .update(icloudCalendarAccount)
      .set({ userId: toUserId })
      .where(eq(icloudCalendarAccount.userId, fromUserId)),
    // Primary-key tables: keep the real account's row when both exist.
    database
      .delete(userProfile)
      .where(eq(userProfile.userId, fromUserId)),
    database
      .delete(billingAccount)
      .where(eq(billingAccount.userId, fromUserId)),
  ] as const;

  if (typeof (database as { batch?: unknown }).batch === "function") {
    await database.batch(operations);
    return;
  }

  for (const op of operations) {
    await op;
  }
}

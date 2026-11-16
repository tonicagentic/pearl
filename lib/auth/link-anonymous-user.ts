import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  agentAttachment,
  area,
  billingAccount,
  chat,
  conceptSchema,
  conceptSchemaRevision,
  devicePushToken,
  icloudCalendarAccount,
  issue,
  mailAccount,
  mailRule,
  miniApp,
  plan,
  project,
  usageEvent,
  usageReservation,
  userProfile,
  userSkill,
  workbenchPin,
} from "@/lib/db/schema";

/**
 * Move guest-owned rows onto the real account before better-auth deletes the
 * anonymous user. Skip `session` and `account` — those stay with each identity.
 */
export async function reassignAnonymousUserData(input: {
  readonly fromUserId: string;
  readonly toUserId: string;
}): Promise<void> {
  const { fromUserId, toUserId } = input;
  if (fromUserId === toUserId) {
    return;
  }

  await db.transaction(async (tx) => {
    await tx
      .update(chat)
      .set({ userId: toUserId })
      .where(eq(chat.userId, fromUserId));
    await tx
      .update(agentAttachment)
      .set({ userId: toUserId })
      .where(eq(agentAttachment.userId, fromUserId));
    await tx
      .update(area)
      .set({ userId: toUserId })
      .where(eq(area.userId, fromUserId));
    await tx
      .update(issue)
      .set({ userId: toUserId })
      .where(eq(issue.userId, fromUserId));
    await tx
      .update(miniApp)
      .set({ userId: toUserId })
      .where(eq(miniApp.userId, fromUserId));
    await tx
      .update(userSkill)
      .set({ userId: toUserId })
      .where(eq(userSkill.userId, fromUserId));
    await tx
      .update(project)
      .set({ userId: toUserId })
      .where(eq(project.userId, fromUserId));
    await tx
      .update(plan)
      .set({ userId: toUserId })
      .where(eq(plan.userId, fromUserId));
    await tx
      .update(devicePushToken)
      .set({ userId: toUserId })
      .where(eq(devicePushToken.userId, fromUserId));
    await tx
      .update(usageEvent)
      .set({ userId: toUserId })
      .where(eq(usageEvent.userId, fromUserId));
    await tx
      .update(usageReservation)
      .set({ userId: toUserId })
      .where(eq(usageReservation.userId, fromUserId));
    await tx
      .update(conceptSchema)
      .set({ userId: toUserId })
      .where(eq(conceptSchema.userId, fromUserId));
    await tx
      .update(conceptSchemaRevision)
      .set({ userId: toUserId })
      .where(eq(conceptSchemaRevision.userId, fromUserId));
    await tx
      .update(workbenchPin)
      .set({ userId: toUserId })
      .where(eq(workbenchPin.userId, fromUserId));
    await tx
      .update(mailAccount)
      .set({ userId: toUserId })
      .where(eq(mailAccount.userId, fromUserId));
    await tx
      .update(mailRule)
      .set({ userId: toUserId })
      .where(eq(mailRule.userId, fromUserId));
    await tx
      .update(icloudCalendarAccount)
      .set({ userId: toUserId })
      .where(eq(icloudCalendarAccount.userId, fromUserId));

    // Primary-key tables: keep the real account's row when both exist.
    await tx
      .delete(userProfile)
      .where(eq(userProfile.userId, fromUserId));
    await tx
      .delete(billingAccount)
      .where(eq(billingAccount.userId, fromUserId));
  });
}

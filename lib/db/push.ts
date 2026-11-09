import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { devicePushToken, pushDelivery } from "@/lib/db/schema";

export type PushDeliveryKind = "needs_you" | "replied" | "failed";

export type DevicePushTokenRow = {
  readonly id: string;
  readonly token: string;
  readonly platform: string;
};

/**
 * Upsert an Expo push token for the signed-in user. Reassigning the token
 * when another account signs in on the same device keeps delivery pointed at
 * the active user.
 */
export async function upsertDevicePushToken(input: {
  readonly userId: string;
  readonly token: string;
  readonly platform: string;
}): Promise<void> {
  const token = input.token.trim();
  const platform = input.platform.trim() || "unknown";

  if (!token) {
    throw new Error("Push token is required.");
  }

  await db
    .insert(devicePushToken)
    .values({
      userId: input.userId,
      token,
      platform,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: devicePushToken.token,
      set: {
        userId: input.userId,
        platform,
        updatedAt: new Date(),
      },
    });
}

export async function deleteDevicePushToken(input: {
  readonly userId: string;
  readonly token: string;
}): Promise<void> {
  const token = input.token.trim();
  if (!token) {
    return;
  }

  await db
    .delete(devicePushToken)
    .where(
      and(
        eq(devicePushToken.userId, input.userId),
        eq(devicePushToken.token, token),
      ),
    );
}

export async function deleteDevicePushTokensByValues(
  tokens: readonly string[],
): Promise<void> {
  const unique = [...new Set(tokens.map((token) => token.trim()).filter(Boolean))];
  if (unique.length === 0) {
    return;
  }

  for (const token of unique) {
    await db.delete(devicePushToken).where(eq(devicePushToken.token, token));
  }
}

export async function listDevicePushTokensForUser(
  userId: string,
): Promise<DevicePushTokenRow[]> {
  return db
    .select({
      id: devicePushToken.id,
      token: devicePushToken.token,
      platform: devicePushToken.platform,
    })
    .from(devicePushToken)
    .where(eq(devicePushToken.userId, userId));
}

/** True when this turn boundary already claimed a delivery of `kind`. */
export async function hasPushDelivery(input: {
  readonly sessionId: string;
  readonly turnId: string;
  readonly kind: PushDeliveryKind;
}): Promise<boolean> {
  const [row] = await db
    .select({ id: pushDelivery.id })
    .from(pushDelivery)
    .where(
      and(
        eq(pushDelivery.sessionId, input.sessionId),
        eq(pushDelivery.turnId, input.turnId),
        eq(pushDelivery.kind, input.kind),
      ),
    )
    .limit(1);

  return Boolean(row);
}

/**
 * Insert a delivery marker. Returns true only for the first writer so a
 * retried hook step cannot send a second banner.
 */
export async function claimPushDelivery(input: {
  readonly sessionId: string;
  readonly turnId: string;
  readonly kind: PushDeliveryKind;
}): Promise<boolean> {
  const [row] = await db
    .insert(pushDelivery)
    .values({
      sessionId: input.sessionId,
      turnId: input.turnId,
      kind: input.kind,
    })
    .onConflictDoNothing()
    .returning({ id: pushDelivery.id });

  return Boolean(row);
}

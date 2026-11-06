import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { userProfile, type UserProfile } from "@/lib/db/schema";
import {
  normalizeProfileInput,
  type ProfileFormInput,
} from "@/lib/profile/validation";

export async function getUserProfile(
  userId: string,
): Promise<UserProfile | null> {
  const [row] = await db
    .select()
    .from(userProfile)
    .where(eq(userProfile.userId, userId))
    .limit(1);
  return row ?? null;
}

export async function upsertUserProfile(
  userId: string,
  input: ProfileFormInput,
): Promise<UserProfile> {
  const normalized = normalizeProfileInput(input);
  const now = new Date();

  const [row] = await db
    .insert(userProfile)
    .values({
      userId,
      ...normalized,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: userProfile.userId,
      set: {
        ...normalized,
        updatedAt: now,
      },
    })
    .returning();

  if (!row) {
    throw new Error("Could not save profile.");
  }
  return row;
}

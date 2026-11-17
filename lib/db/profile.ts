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

const PROFILE_INPUT_KEYS = [
  "displayName",
  "birthdate",
  "nationality",
  "height",
  "eyeColor",
  "hairColor",
  "skinTone",
  "weight",
  "build",
  "gender",
  "measurements",
  "healthNotes",
  "primaryResidence",
  "additionalHomes",
  "planPreferences",
] as const satisfies readonly (keyof ProfileFormInput)[];

function rowToInput(row: UserProfile): ProfileFormInput {
  return {
    displayName: row.displayName,
    birthdate: row.birthdate,
    nationality: row.nationality,
    height: row.height,
    eyeColor: row.eyeColor,
    hairColor: row.hairColor,
    skinTone: row.skinTone,
    weight: row.weight,
    build: row.build,
    gender: row.gender,
    measurements: row.measurements,
    healthNotes: row.healthNotes,
    primaryResidence: row.primaryResidence,
    additionalHomes: row.additionalHomes,
    planPreferences: row.planPreferences,
  };
}

/** Absent keys keep the stored value. Explicit null clears a field. */
function mergeProfileInput(
  base: ProfileFormInput,
  patch: ProfileFormInput,
): ProfileFormInput {
  const next: {
    -readonly [K in keyof ProfileFormInput]: ProfileFormInput[K];
  } = { ...base };
  for (const key of PROFILE_INPUT_KEYS) {
    if (patch[key] !== undefined) {
      next[key] = patch[key];
    }
  }
  return next;
}

export async function upsertUserProfile(
  userId: string,
  input: ProfileFormInput,
): Promise<UserProfile> {
  const existing = await getUserProfile(userId);
  const normalized = normalizeProfileInput(
    mergeProfileInput(existing ? rowToInput(existing) : {}, input),
  );
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

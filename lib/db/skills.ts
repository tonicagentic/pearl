import { and, asc, eq, isNotNull, sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  userSkill,
  type UserSkill,
  type UserSkillFiles,
  type UserSkillSource,
} from "@/lib/db/schema";
import {
  MAX_ENABLED_SKILLS,
  MAX_USER_PACKAGE_BYTES,
  packageByteLength,
} from "@/lib/skills/validation";

export type UserSkillInput = {
  readonly slug: string;
  readonly title: string;
  readonly description: string;
  readonly markdown: string;
  readonly files?: UserSkillFiles;
  readonly enabled?: boolean;
  readonly source?: UserSkillSource;
  readonly registryName?: string | null;
};

export async function listUserSkills(
  userId: string,
): Promise<readonly UserSkill[]> {
  return db
    .select()
    .from(userSkill)
    .where(eq(userSkill.userId, userId))
    .orderBy(asc(userSkill.title));
}

export async function listEnabledUserSkills(
  userId: string,
): Promise<readonly UserSkill[]> {
  return db
    .select()
    .from(userSkill)
    .where(and(eq(userSkill.userId, userId), eq(userSkill.enabled, true)))
    .orderBy(asc(userSkill.slug));
}

export async function getUserSkill(
  userId: string,
  id: string,
): Promise<UserSkill | null> {
  const [row] = await db
    .select()
    .from(userSkill)
    .where(and(eq(userSkill.userId, userId), eq(userSkill.id, id)))
    .limit(1);
  return row ?? null;
}

export async function getUserSkillBySlug(
  userId: string,
  slug: string,
): Promise<UserSkill | null> {
  const [row] = await db
    .select()
    .from(userSkill)
    .where(and(eq(userSkill.userId, userId), eq(userSkill.slug, slug)))
    .limit(1);
  return row ?? null;
}

export async function getUserSkillByRegistryName(
  userId: string,
  registryName: string,
): Promise<UserSkill | null> {
  const [row] = await db
    .select()
    .from(userSkill)
    .where(
      and(
        eq(userSkill.userId, userId),
        eq(userSkill.registryName, registryName),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function countEnabledUserSkills(userId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(userSkill)
    .where(and(eq(userSkill.userId, userId), eq(userSkill.enabled, true)));
  return row?.count ?? 0;
}

export async function totalEnabledPackageBytes(
  userId: string,
  excludeId?: string,
): Promise<number> {
  const rows = await listEnabledUserSkills(userId);
  return rows
    .filter((row) => row.id !== excludeId)
    .reduce(
      (sum, row) => sum + packageByteLength(row.markdown, row.files ?? {}),
      0,
    );
}

export async function assertCanEnableSkill(input: {
  readonly userId: string;
  readonly excludeId?: string;
  readonly markdown: string;
  readonly files: UserSkillFiles;
  readonly enabling: boolean;
}): Promise<void> {
  if (!input.enabling) {
    return;
  }

  const enabledCount = await countEnabledUserSkills(input.userId);
  const alreadyEnabled = input.excludeId
    ? (await getUserSkill(input.userId, input.excludeId))?.enabled === true
    : false;
  const nextCount = alreadyEnabled ? enabledCount : enabledCount + 1;

  if (nextCount > MAX_ENABLED_SKILLS) {
    throw new Error(
      `You can enable at most ${String(MAX_ENABLED_SKILLS)} skills.`,
    );
  }

  const existingBytes = await totalEnabledPackageBytes(
    input.userId,
    input.excludeId,
  );
  const nextBytes =
    existingBytes + packageByteLength(input.markdown, input.files);

  if (nextBytes > MAX_USER_PACKAGE_BYTES) {
    throw new Error(
      `Enabled skills would exceed the ${String(MAX_USER_PACKAGE_BYTES)} byte package limit.`,
    );
  }
}

export async function createUserSkill(
  userId: string,
  input: UserSkillInput,
): Promise<UserSkill> {
  const files = input.files ?? {};
  const enabled = input.enabled ?? true;

  await assertCanEnableSkill({
    userId,
    markdown: input.markdown,
    files,
    enabling: enabled,
  });

  const [row] = await db
    .insert(userSkill)
    .values({
      userId,
      slug: input.slug,
      title: input.title,
      description: input.description,
      markdown: input.markdown,
      files,
      enabled,
      source: input.source ?? "custom",
      registryName: input.registryName ?? null,
      updatedAt: new Date(),
    })
    .returning();

  if (!row) {
    throw new Error("Could not create skill.");
  }

  return row;
}

export async function updateUserSkill(
  userId: string,
  id: string,
  patch: Partial<UserSkillInput>,
): Promise<UserSkill> {
  const existing = await getUserSkill(userId, id);

  if (!existing) {
    throw new Error("Skill not found.");
  }

  const next = {
    slug: patch.slug ?? existing.slug,
    title: patch.title ?? existing.title,
    description: patch.description ?? existing.description,
    markdown: patch.markdown ?? existing.markdown,
    files: patch.files ?? existing.files ?? {},
    enabled: patch.enabled ?? existing.enabled,
    source: patch.source ?? existing.source,
    registryName:
      patch.registryName === undefined
        ? existing.registryName
        : patch.registryName,
  };

  await assertCanEnableSkill({
    userId,
    excludeId: id,
    markdown: next.markdown,
    files: next.files,
    enabling: next.enabled,
  });

  const [row] = await db
    .update(userSkill)
    .set({
      ...next,
      updatedAt: new Date(),
    })
    .where(and(eq(userSkill.userId, userId), eq(userSkill.id, id)))
    .returning();

  if (!row) {
    throw new Error("Could not update skill.");
  }

  return row;
}

export async function upsertUserSkillFromRegistry(
  userId: string,
  input: UserSkillInput & { readonly registryName: string },
): Promise<UserSkill> {
  const existing = await getUserSkillByRegistryName(userId, input.registryName);

  if (existing) {
    return updateUserSkill(userId, existing.id, {
      ...input,
      source: "registry",
      registryName: input.registryName,
    });
  }

  return createUserSkill(userId, {
    ...input,
    source: "registry",
    registryName: input.registryName,
  });
}

export async function deleteUserSkill(
  userId: string,
  id: string,
): Promise<boolean> {
  const deleted = await db
    .delete(userSkill)
    .where(and(eq(userSkill.userId, userId), eq(userSkill.id, id)))
    .returning({ id: userSkill.id });
  return deleted.length > 0;
}

/** Drop the unique index conflict when registryName is null for many rows. */
export async function listRegistryInstalls(
  userId: string,
): Promise<readonly UserSkill[]> {
  return db
    .select()
    .from(userSkill)
    .where(
      and(eq(userSkill.userId, userId), isNotNull(userSkill.registryName)),
    )
    .orderBy(asc(userSkill.title));
}

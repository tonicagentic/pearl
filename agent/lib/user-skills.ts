import {
  createUserSkill,
  deleteUserSkill,
  getUserSkillBySlug,
  listUserSkills,
  updateUserSkill,
} from "@/lib/db/skills";
import { ensureUserForPrincipal } from "@/lib/db/issues";
import type { UserSkill } from "@/lib/db/schema";
import { validateSkillSlug } from "@/lib/skills/validate-slug";
import {
  MAX_CUSTOM_MARKDOWN_LENGTH,
  validateSkillDescription,
  validateSkillMarkdown,
} from "@/lib/skills/validation";

/**
 * Structural subset of eve's session principal for skill tools.
 */
export type SkillPrincipal =
  | {
      readonly principalId: string;
      readonly principalType: string;
      readonly attributes?: Readonly<Record<string, string | readonly string[]>>;
    }
  | null
  | undefined;

export function requireUserPrincipal(principal: SkillPrincipal): {
  readonly principalId: string;
  readonly attributes: Readonly<Record<string, string | readonly string[]>>;
} {
  if (principal?.principalType !== "user" || !principal.principalId) {
    throw new Error("Sign in to manage skills.");
  }
  return {
    principalId: principal.principalId,
    attributes: principal.attributes ?? {},
  };
}

async function ensurePrincipalUser(principal: SkillPrincipal) {
  const user = requireUserPrincipal(principal);
  await ensureUserForPrincipal({
    principalId: user.principalId,
    attributes: user.attributes,
  });
  return user;
}

function normalizeWritableSkill(input: {
  readonly slug: string;
  readonly title: string;
  readonly description: string;
  readonly markdown: string;
}) {
  const title = input.title.trim();
  const slug = input.slug.trim();
  const description = input.description.trim();
  const markdown = input.markdown;

  if (!title) {
    throw new Error("A skill needs a title.");
  }

  const slugError = validateSkillSlug(slug);
  if (slugError) {
    throw new Error(slugError.message);
  }

  const descriptionError = validateSkillDescription(description);
  if (descriptionError) {
    throw new Error(descriptionError.message);
  }

  const markdownError = validateSkillMarkdown(
    markdown,
    MAX_CUSTOM_MARKDOWN_LENGTH,
  );
  if (markdownError) {
    throw new Error(markdownError.message);
  }

  return { title, slug, description, markdown };
}

export async function listSkillsForPrincipal(
  principal: SkillPrincipal,
): Promise<readonly UserSkill[]> {
  const user = requireUserPrincipal(principal);
  return listUserSkills(user.principalId);
}

export async function getSkillForPrincipal(
  principal: SkillPrincipal,
  slug: string,
): Promise<UserSkill | null> {
  const user = requireUserPrincipal(principal);
  return getUserSkillBySlug(user.principalId, slug.trim());
}

export async function createSkillForPrincipal(
  principal: SkillPrincipal,
  input: {
    readonly slug: string;
    readonly title: string;
    readonly description: string;
    readonly markdown: string;
    readonly enabled?: boolean;
  },
): Promise<UserSkill> {
  const user = await ensurePrincipalUser(principal);
  const normalized = normalizeWritableSkill(input);

  const clash = await getUserSkillBySlug(user.principalId, normalized.slug);
  if (clash) {
    throw new Error(`You already have a skill named "${normalized.slug}".`);
  }

  return createUserSkill(user.principalId, {
    ...normalized,
    files: {},
    enabled: input.enabled ?? true,
    source: "custom",
  });
}

export async function updateSkillForPrincipal(
  principal: SkillPrincipal,
  input: {
    readonly slug: string;
    readonly title?: string;
    readonly description?: string;
    readonly markdown?: string;
    readonly enabled?: boolean;
    readonly newSlug?: string;
  },
): Promise<UserSkill> {
  const user = await ensurePrincipalUser(principal);
  const existing = await getUserSkillBySlug(user.principalId, input.slug.trim());
  if (!existing) {
    throw new Error(`No skill named "${input.slug.trim()}".`);
  }

  const nextSlug = (input.newSlug ?? existing.slug).trim();
  const normalized = normalizeWritableSkill({
    slug: nextSlug,
    title: input.title ?? existing.title,
    description: input.description ?? existing.description,
    markdown: input.markdown ?? existing.markdown,
  });

  if (normalized.slug !== existing.slug) {
    const clash = await getUserSkillBySlug(user.principalId, normalized.slug);
    if (clash) {
      throw new Error(`You already have a skill named "${normalized.slug}".`);
    }
  }

  return updateUserSkill(user.principalId, existing.id, {
    ...normalized,
    enabled: input.enabled ?? existing.enabled,
    files: existing.files ?? {},
  });
}

export async function deleteSkillForPrincipal(
  principal: SkillPrincipal,
  slug: string,
): Promise<{ deleted: true; slug: string }> {
  const user = await ensurePrincipalUser(principal);
  const existing = await getUserSkillBySlug(user.principalId, slug.trim());
  if (!existing) {
    throw new Error(`No skill named "${slug.trim()}".`);
  }
  await deleteUserSkill(user.principalId, existing.id);
  return { deleted: true, slug: existing.slug };
}

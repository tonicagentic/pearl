import {
  createUserSkill,
  deleteUserSkill,
  getUserSkill,
  getUserSkillBySlug,
  updateUserSkill,
  upsertUserSkillFromRegistry,
} from "@/lib/db/skills";
import type { UserSkill } from "@/lib/db/schema";
import {
  fetchSkillsRegistryItem,
  searchSkillsRegistry,
  type RegistrySearchHit,
  type RegistrySkillPackage,
} from "@/lib/skills/registry";
import { validateSkillSlug } from "@/lib/skills/validate-slug";
import {
  MAX_CUSTOM_MARKDOWN_LENGTH,
  MAX_SKILL_DESCRIPTION_LENGTH,
  packageByteLength,
  validateSkillDescription,
  validateSkillFiles,
  validateSkillMarkdown,
} from "@/lib/skills/validation";

export type SkillFormInput = {
  readonly slug?: string;
  readonly title?: string;
  readonly description?: string;
  readonly markdown?: string;
  readonly enabled?: boolean;
};

export function normalizeCustomSkillInput(input: SkillFormInput) {
  const title = input.title?.trim() ?? "";
  const slug = input.slug?.trim() ?? "";
  const description = input.description?.trim() ?? "";
  const markdown = input.markdown ?? "";

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

  return {
    title,
    slug,
    description,
    markdown,
    enabled: input.enabled ?? true,
  };
}

export async function createCustomSkill(
  userId: string,
  input: SkillFormInput,
): Promise<UserSkill> {
  const normalized = normalizeCustomSkillInput(input);

  const clash = await getUserSkillBySlug(userId, normalized.slug);
  if (clash) {
    throw new Error(`You already have a skill named "${normalized.slug}".`);
  }

  return createUserSkill(userId, {
    ...normalized,
    files: {},
    source: "custom",
  });
}

export async function updateCustomSkill(
  userId: string,
  id: string,
  input: SkillFormInput,
): Promise<UserSkill> {
  const existing = await getUserSkill(userId, id);
  if (!existing) {
    throw new Error("Skill not found.");
  }

  const normalized = normalizeCustomSkillInput({
    title: input.title ?? existing.title,
    slug: input.slug ?? existing.slug,
    description: input.description ?? existing.description,
    markdown: input.markdown ?? existing.markdown,
    enabled: input.enabled ?? existing.enabled,
  });

  if (normalized.slug !== existing.slug) {
    const clash = await getUserSkillBySlug(userId, normalized.slug);
    if (clash) {
      throw new Error(`You already have a skill named "${normalized.slug}".`);
    }
  }

  const filesError = validateSkillFiles(existing.files ?? {});
  if (filesError) {
    throw new Error(filesError.message);
  }

  return updateUserSkill(userId, id, {
    ...normalized,
    files: existing.files ?? {},
  });
}

export async function setSkillEnabled(
  userId: string,
  id: string,
  enabled: boolean,
): Promise<UserSkill> {
  return updateUserSkill(userId, id, { enabled });
}

export async function removeSkill(userId: string, id: string): Promise<void> {
  const deleted = await deleteUserSkill(userId, id);
  if (!deleted) {
    throw new Error("Skill not found.");
  }
}

export async function searchPublishedSkills(query: string): Promise<{
  readonly items: readonly RegistrySearchHit[];
  readonly total: number;
  readonly hasMore: boolean;
}> {
  return searchSkillsRegistry({
    query,
    limit: 20,
    offset: 0,
  });
}

export async function previewPublishedSkill(
  registryName: string,
): Promise<RegistrySkillPackage> {
  return fetchSkillsRegistryItem(registryName);
}

export async function installPublishedSkill(
  userId: string,
  registryName: string,
): Promise<UserSkill> {
  const pkg = await fetchSkillsRegistryItem(registryName);

  const slugError = validateSkillSlug(pkg.slug);
  if (slugError) {
    throw new Error(slugError.message);
  }

  const descriptionError = validateSkillDescription(pkg.description);
  if (descriptionError) {
    throw new Error(descriptionError.message);
  }

  const filesError = validateSkillFiles(pkg.files);
  if (filesError) {
    throw new Error(filesError.message);
  }

  let slug = pkg.slug;
  const existingSlug = await getUserSkillBySlug(userId, slug);
  if (existingSlug && existingSlug.registryName !== pkg.registryName) {
    for (let i = 2; i < 50; i += 1) {
      const candidate = `${pkg.slug}-${String(i)}`.slice(0, 64);
      if (!(await getUserSkillBySlug(userId, candidate))) {
        slug = candidate;
        break;
      }
    }
  }

  void packageByteLength(pkg.markdown, pkg.files);

  return upsertUserSkillFromRegistry(userId, {
    slug,
    title: pkg.title,
    description: pkg.description.slice(0, MAX_SKILL_DESCRIPTION_LENGTH),
    markdown: pkg.markdown,
    files: pkg.files,
    enabled: true,
    registryName: pkg.registryName,
  });
}

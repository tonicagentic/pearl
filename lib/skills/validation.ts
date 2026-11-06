/** Max length of the routing description advertised every turn. */
export const MAX_SKILL_DESCRIPTION_LENGTH = 300;

/** Max length of a custom skill's SKILL.md body. */
export const MAX_CUSTOM_MARKDOWN_LENGTH = 32_000;

/** Max total text size for a registry-installed package (markdown + files). */
export const MAX_REGISTRY_PACKAGE_BYTES = 1_000_000;

/** Max enabled skills per user (catalog size). */
export const MAX_ENABLED_SKILLS = 20;

/** Soft cap on total package bytes across a user's enabled skills. */
export const MAX_USER_PACKAGE_BYTES = 2_000_000;

/** Max slug length (eve skill package name). */
export const MAX_SKILL_SLUG_LENGTH = 64;

/**
 * Shell-safe skill name: alphanumeric start, then alphanumerics / `.` / `_` / `-`.
 * Matches eve's assertSafeSkillPackageName.
 */
export const SKILL_SLUG_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/**
 * Whether a relative package path is safe to store (matches eve's
 * assertSafeSkillPackageFilePath: relative POSIX, no traversal, not SKILL.md).
 */
export function isSafeSkillFilePath(path: string): boolean {
  if (path === "SKILL.md" || path.length === 0) {
    return false;
  }
  if (path.startsWith("/") || path.includes("\\") || /^[A-Za-z]:/.test(path)) {
    return false;
  }
  return !path.split("/").some(
    (segment) => segment.length === 0 || segment === "." || segment === "..",
  );
}

export type SkillValidationError = {
  readonly field?: string;
  readonly message: string;
};

export function validateSkillSlugShape(
  slug: string,
): SkillValidationError | null {
  const trimmed = slug.trim();
  if (!trimmed) {
    return { field: "slug", message: "A skill needs a slug." };
  }
  if (trimmed.length > MAX_SKILL_SLUG_LENGTH) {
    return {
      field: "slug",
      message: `Slug must be at most ${String(MAX_SKILL_SLUG_LENGTH)} characters.`,
    };
  }
  if (!SKILL_SLUG_PATTERN.test(trimmed)) {
    return {
      field: "slug",
      message:
        "Slug must start with a letter or digit and contain only letters, digits, '.', '_', or '-'.",
    };
  }
  return null;
}

export function validateSkillDescription(
  description: string,
): SkillValidationError | null {
  const trimmed = description.trim();
  if (!trimmed) {
    return { field: "description", message: "A skill needs a description." };
  }
  if (trimmed.length > MAX_SKILL_DESCRIPTION_LENGTH) {
    return {
      field: "description",
      message: `Description must be at most ${String(MAX_SKILL_DESCRIPTION_LENGTH)} characters.`,
    };
  }
  return null;
}

export function validateSkillMarkdown(
  markdown: string,
  maxLength: number = MAX_CUSTOM_MARKDOWN_LENGTH,
): SkillValidationError | null {
  if (!markdown.trim()) {
    return { field: "markdown", message: "A skill needs a body." };
  }
  if (markdown.length > maxLength) {
    return {
      field: "markdown",
      message: `Skill body must be at most ${String(maxLength)} characters.`,
    };
  }
  return null;
}

export function validateSkillFiles(
  files: Readonly<Record<string, string>>,
): SkillValidationError | null {
  for (const [path, content] of Object.entries(files)) {
    if (path === "SKILL.md") {
      return {
        field: "files",
        message:
          "Do not include SKILL.md in package files; it is generated from markdown.",
      };
    }
    if (!isSafeSkillFilePath(path)) {
      return {
        field: "files",
        message: `Invalid package file path: ${path}`,
      };
    }
    if (typeof content !== "string") {
      return {
        field: "files",
        message: `Package file "${path}" must be text.`,
      };
    }
  }
  return null;
}

export function packageByteLength(
  markdown: string,
  files: Readonly<Record<string, string>>,
): number {
  let total = Buffer.byteLength(markdown, "utf8");
  for (const content of Object.values(files)) {
    total += Buffer.byteLength(content, "utf8");
  }
  return total;
}

export function slugFromTitle(title: string): string {
  const base = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SKILL_SLUG_LENGTH);
  if (!base) {
    return "skill";
  }
  return /^[0-9]/.test(base) ? `s-${base}` : base;
}

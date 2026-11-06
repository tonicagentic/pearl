import { validateSkillSlug } from "@/lib/skills/validate-slug";
import {
  isSafeSkillFilePath,
  MAX_REGISTRY_PACKAGE_BYTES,
  MAX_SKILL_DESCRIPTION_LENGTH,
  packageByteLength,
  slugFromTitle,
} from "@/lib/skills/validation";

const SKILLS_REGISTRY_CATALOG =
  "https://www.skills.sh/r/registry?agent=eve";
const SKILLS_REGISTRY_ITEM =
  "https://www.skills.sh/r/{name}?agent=eve";

export type RegistrySearchHit = {
  readonly name: string;
  readonly title: string;
  readonly description: string;
};

export type RegistrySkillPackage = {
  readonly registryName: string;
  readonly slug: string;
  readonly title: string;
  readonly description: string;
  readonly author: string | null;
  readonly markdown: string;
  readonly files: Record<string, string>;
  readonly filePaths: readonly string[];
};

type RegistryCatalogResponse = {
  readonly items?: readonly {
    readonly name?: string;
    readonly title?: string;
    readonly description?: string;
  }[];
};

type RegistryItemResponse = {
  readonly name?: string;
  readonly title?: string;
  readonly description?: string;
  readonly author?: string;
  readonly files?: readonly {
    readonly path?: string;
    readonly content?: string;
  }[];
};

function isProbablyBinary(content: string): boolean {
  if (content.includes("\u0000")) {
    return true;
  }
  // Heuristic: too many non-printable control chars.
  let controls = 0;
  const sample = content.slice(0, 4_000);
  for (let i = 0; i < sample.length; i += 1) {
    const code = sample.charCodeAt(i);
    if (code < 9 || (code > 13 && code < 32)) {
      controls += 1;
    }
  }
  return controls > sample.length * 0.05;
}

function normalizeSiblingPath(path: string): string | null {
  const normalized = path.replace(/^\/+/, "").replace(/\\/g, "/");
  if (
    normalized === "SKILL.md" ||
    normalized.toLowerCase() === "skill.md" ||
    !isSafeSkillFilePath(normalized)
  ) {
    return null;
  }
  return normalized;
}

function pickMarkdown(files: readonly { path: string; content: string }[]): {
  markdown: string;
  siblings: Record<string, string>;
} {
  const siblings: Record<string, string> = {};
  let markdown = "";

  for (const file of files) {
    const base = file.path.split("/").pop() ?? file.path;
    if (base === "SKILL.md" || base.toLowerCase() === "skill.md") {
      markdown = file.content;
      continue;
    }
    const sibling = normalizeSiblingPath(file.path);
    if (!sibling) {
      continue;
    }
    siblings[sibling] = file.content;
  }

  if (!markdown.trim()) {
    // Some packages put the procedure in AGENTS.md without SKILL.md.
    const agents = files.find(
      (file) => (file.path.split("/").pop() ?? "") === "AGENTS.md",
    );
    if (agents) {
      markdown = agents.content;
      delete siblings[normalizeSiblingPath(agents.path) ?? ""];
    }
  }

  return { markdown, siblings };
}

function slugFromRegistryName(registryName: string, title: string): string {
  const leaf = registryName.split("/").pop() ?? registryName;
  const fromName = slugFromTitle(leaf);
  const slugError = validateSkillSlug(fromName);
  if (!slugError) {
    return fromName;
  }
  const fromTitle = slugFromTitle(title);
  const titleError = validateSkillSlug(fromTitle);
  if (!titleError) {
    return fromTitle;
  }
  return `skill-${fromName}`.slice(0, 64);
}

export async function searchSkillsRegistry(input: {
  readonly query: string;
  readonly limit?: number;
  readonly offset?: number;
  readonly signal?: AbortSignal;
}): Promise<{
  readonly items: readonly RegistrySearchHit[];
  readonly total: number;
  readonly hasMore: boolean;
}> {
  const url = new URL(SKILLS_REGISTRY_CATALOG);
  if (input.query.trim()) {
    url.searchParams.set("q", input.query.trim());
  }
  url.searchParams.set("limit", String(input.limit ?? 20));
  url.searchParams.set("offset", String(input.offset ?? 0));

  const response = await fetch(url, {
    signal: input.signal ?? AbortSignal.timeout(15_000),
    headers: { accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`skills.sh search failed (${String(response.status)}).`);
  }

  const data = (await response.json()) as RegistryCatalogResponse & {
    readonly pagination?: {
      readonly total?: number;
      readonly hasMore?: boolean;
    };
  };

  const items = (data.items ?? [])
    .filter((item): item is { name: string; title?: string; description?: string } =>
      typeof item.name === "string" && item.name.length > 0,
    )
    .map((item) => ({
      name: item.name,
      title: item.title?.trim() || item.name.split("/").pop() || item.name,
      description: (item.description ?? "").trim(),
    }));

  return {
    items,
    total: data.pagination?.total ?? items.length,
    hasMore: data.pagination?.hasMore ?? false,
  };
}

export async function fetchSkillsRegistryItem(
  registryName: string,
  signal?: AbortSignal,
): Promise<RegistrySkillPackage> {
  const name = registryName.trim();
  if (!name || name.includes("..") || name.startsWith("/") || name.includes("\\")) {
    throw new Error("Invalid registry skill name.");
  }

  const url = SKILLS_REGISTRY_ITEM.replace(
    "{name}",
    name
      .split("/")
      .map((part) => encodeURIComponent(part))
      .join("/"),
  );

  const response = await fetch(url, {
    signal: signal ?? AbortSignal.timeout(30_000),
    headers: { accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(
      `Could not fetch skill "${name}" (${String(response.status)}).`,
    );
  }

  const data = (await response.json()) as RegistryItemResponse;
  const rawFiles = (data.files ?? [])
    .filter(
      (file): file is { path: string; content: string } =>
        typeof file.path === "string" &&
        typeof file.content === "string" &&
        file.path.length > 0,
    )
    .filter((file) => !isProbablyBinary(file.content));

  const { markdown, siblings } = pickMarkdown(rawFiles);

  if (!markdown.trim()) {
    throw new Error(`Skill "${name}" has no SKILL.md (or AGENTS.md) body.`);
  }

  const title =
    data.title?.trim() || data.name?.split("/").pop() || name.split("/").pop() || name;
  const description = (data.description ?? "").trim().slice(
    0,
    MAX_SKILL_DESCRIPTION_LENGTH,
  );

  if (!description) {
    throw new Error(`Skill "${name}" is missing a description.`);
  }

  const bytes = packageByteLength(markdown, siblings);
  if (bytes > MAX_REGISTRY_PACKAGE_BYTES) {
    throw new Error(
      `Skill package is ${String(bytes)} bytes; max is ${String(MAX_REGISTRY_PACKAGE_BYTES)}.`,
    );
  }

  return {
    registryName: name,
    slug: slugFromRegistryName(name, title),
    title,
    description,
    author: data.author?.trim() || null,
    markdown,
    files: siblings,
    filePaths: Object.keys(siblings).sort(),
  };
}

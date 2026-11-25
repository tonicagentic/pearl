import {
  artifactsPrefix,
  normalizeArtifactSlug,
} from "@/agent/lib/artifacts";
import { contentTypeForWorkspacePath } from "@/agent/lib/design-files";
import {
  planMirrorPath,
  planMirrorSlug,
} from "@/agent/lib/plan-mirror";
import { putPrivateBlob, readPrivateBlobText } from "@/lib/blob/private";
import {
  getProjectArtifact,
  linkArtifactToProject,
  listProjectArtifacts,
  type ProjectArtifactDto,
  updateProjectArtifactTitle,
} from "@/lib/db/project-artifacts";
import { getProject, slugify } from "@/lib/db/projects";

const MAX_TITLE = 200;
const MAX_MARKDOWN = 200_000;
const MAX_SLUG = 80;

export type ProjectFileWriteResult = {
  readonly artifact: ProjectArtifactDto;
  readonly path: string;
  readonly pathname: string;
  readonly slug: string;
  readonly title: string;
  readonly mirrored: boolean;
  readonly note?: string;
};

export type ProjectFileReadResult = {
  readonly artifact: ProjectArtifactDto;
  readonly path: string;
  readonly pathname: string;
  readonly content: string;
  /** Body with YAML frontmatter stripped when present. */
  readonly markdown: string;
  readonly title: string;
  readonly slug: string;
};

type MirrorSession = {
  readonly id: string;
  readonly getSandbox?: () => PromiseLike<{
    writeTextFile: (input: {
      readonly path: string;
      readonly content: string;
    }) => PromiseLike<unknown>;
  }>;
};

function requireTitle(title: string): string {
  const trimmed = title.trim();
  if (!trimmed) throw new Error("A file needs a title.");
  if (trimmed.length > MAX_TITLE) {
    throw new Error(`Titles must be ${MAX_TITLE} characters or fewer.`);
  }
  return trimmed;
}

function fileBody(input: {
  readonly title: string;
  readonly projectId: string;
  readonly slug: string;
  readonly markdown: string;
}): string {
  const frontmatter = [
    "---",
    `title: ${JSON.stringify(input.title)}`,
    `projectId: ${JSON.stringify(input.projectId)}`,
    `slug: ${JSON.stringify(input.slug)}`,
    "---",
    "",
  ].join("\n");
  return `${frontmatter}${input.markdown}`;
}

export function stripProjectFileFrontmatter(content: string): {
  readonly markdown: string;
  readonly title?: string;
  readonly slug?: string;
} {
  if (!content.startsWith("---\n")) {
    return { markdown: content };
  }
  const end = content.indexOf("\n---\n", 4);
  if (end < 0) return { markdown: content };
  const header = content.slice(4, end);
  const markdown = content.slice(end + 5);
  let title: string | undefined;
  let slug: string | undefined;
  for (const line of header.split("\n")) {
    const titleMatch = line.match(/^title:\s*(.*)$/);
    if (titleMatch) {
      try {
        title = JSON.parse(titleMatch[1] ?? "") as string;
      } catch {
        title = titleMatch[1]?.trim();
      }
    }
    const slugMatch = line.match(/^slug:\s*(.*)$/);
    if (slugMatch) {
      try {
        slug = JSON.parse(slugMatch[1] ?? "") as string;
      } catch {
        slug = slugMatch[1]?.trim();
      }
    }
  }
  return { markdown, title, slug };
}

function workspacePathForPathname(pathname: string, prefix: string): string {
  const relative = pathname.startsWith(prefix)
    ? pathname.slice(prefix.length)
    : pathname;
  return relative.startsWith("/")
    ? `/workspace${relative}`
    : `/workspace/${relative}`;
}

function slugFromPathname(pathname: string, projectId: string): string {
  const marker = `docs/plans/${projectId}/`;
  const idx = pathname.indexOf(marker);
  if (idx >= 0) {
    const rest = pathname.slice(idx + marker.length);
    return rest.replace(/\.md$/i, "") || "file";
  }
  const base = pathname.split("/").pop() ?? "file";
  return base.replace(/\.md$/i, "") || "file";
}

/**
 * Write (or overwrite) a project markdown file under
 * `/workspace/docs/plans/<projectId>/<slug>.md`, link it as a project
 * artifact, and optionally mirror into the agent sandbox.
 */
export async function putProjectMarkdownFile(input: {
  readonly userId: string;
  readonly projectId: string;
  readonly title: string;
  readonly markdown?: string;
  readonly slug?: string;
  readonly session?: MirrorSession;
}): Promise<ProjectFileWriteResult> {
  const owned = await getProject(input.userId, input.projectId);
  if (!owned) throw new Error("Unknown project.");

  const title = requireTitle(input.title);
  const markdown = (input.markdown ?? "").slice(0, MAX_MARKDOWN);
  const slug = slugify(input.slug?.trim() || title).slice(0, MAX_SLUG);
  const path = planMirrorPath(input.projectId, slug);
  const content = fileBody({
    title,
    projectId: input.projectId,
    slug,
    markdown,
  });

  let mirrored = false;
  let note: string | undefined;

  if (input.session) {
    try {
      const sandbox = await input.session.getSandbox?.();
      if (sandbox) {
        await sandbox.writeTextFile({ path, content });
      }
    } catch {
      // Sandbox write is best-effort.
    }

    const { persistAgentFile } = await import(
      "@/lib/agent/persist-agent-file"
    );
    const persistence = await persistAgentFile(
      { session: input.session },
      path,
      content,
    );
    mirrored = persistence.persisted;
    note = persistence.note;
  }

  const prefix = artifactsPrefix({
    principalId: input.userId,
    principalType: "user",
  });
  if (!prefix) {
    throw new Error("No principal artifact scope for project files.");
  }

  const relativeSlug =
    normalizeArtifactSlug(path) ?? planMirrorSlug(input.projectId, slug);
  const pathname = `${prefix}${relativeSlug}`;

  try {
    await putPrivateBlob(pathname, content, {
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: contentTypeForWorkspacePath(path),
      signGet: false,
    });
    mirrored = true;
  } catch (error) {
    note = `Could not write project file: ${
      error instanceof Error ? error.message : String(error)
    }`;
    throw new Error(note);
  }

  const artifact = await linkArtifactToProject(
    input.userId,
    input.projectId,
    pathname,
    title,
  );
  if (!artifact) throw new Error("Failed to link project file.");

  return {
    artifact,
    path,
    pathname,
    slug,
    title,
    mirrored,
    note,
  };
}

export async function readProjectFileByArtifactId(input: {
  readonly userId: string;
  readonly projectId: string;
  readonly artifactId: string;
}): Promise<ProjectFileReadResult | null> {
  const artifact = await getProjectArtifact(
    input.userId,
    input.projectId,
    input.artifactId,
  );
  if (!artifact) return null;

  const content = await readPrivateBlobText(artifact.pathname);
  if (content === null) {
    throw new Error("Project file content is missing from storage.");
  }

  const prefix =
    artifactsPrefix({
      principalId: input.userId,
      principalType: "user",
    }) ?? "";
  const path = workspacePathForPathname(artifact.pathname, prefix);
  const parsed = stripProjectFileFrontmatter(content);
  const slug = parsed.slug ?? slugFromPathname(artifact.pathname, input.projectId);

  return {
    artifact,
    path,
    pathname: artifact.pathname,
    content,
    markdown: parsed.markdown,
    title: parsed.title ?? artifact.title,
    slug,
  };
}

export async function updateProjectFile(input: {
  readonly userId: string;
  readonly projectId: string;
  readonly artifactId: string;
  readonly title?: string;
  readonly content?: string;
}): Promise<ProjectFileReadResult> {
  const existing = await readProjectFileByArtifactId(input);
  if (!existing) throw new Error("Unknown project file.");

  const title = input.title !== undefined
    ? requireTitle(input.title)
    : existing.title;
  const rawContent =
    input.content !== undefined ? input.content.slice(0, MAX_MARKDOWN + 2_000) : existing.content;

  // If caller passed full document (with or without frontmatter), normalize.
  const parsed = stripProjectFileFrontmatter(rawContent);
  const markdown =
    input.content !== undefined ? parsed.markdown : existing.markdown;
  const slug = existing.slug;

  const path = planMirrorPath(input.projectId, slug);
  const body = fileBody({
    title,
    projectId: input.projectId,
    slug,
    markdown,
  });

  await putPrivateBlob(existing.pathname, body, {
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: contentTypeForWorkspacePath(path),
    signGet: false,
  });

  if (input.title !== undefined) {
    await updateProjectArtifactTitle(
      input.userId,
      input.projectId,
      input.artifactId,
      title,
    );
  }

  const refreshed = await readProjectFileByArtifactId(input);
  if (!refreshed) throw new Error("Failed to re-read project file.");
  return refreshed;
}

export async function listProjectFiles(
  userId: string,
  projectId: string,
): Promise<readonly ProjectArtifactDto[]> {
  return listProjectArtifacts(userId, projectId);
}

export async function readProjectFileBySlug(input: {
  readonly userId: string;
  readonly projectId: string;
  readonly slug: string;
}): Promise<ProjectFileReadResult | null> {
  const prefix = artifactsPrefix({
    principalId: input.userId,
    principalType: "user",
  });
  if (!prefix) return null;

  const pathname = `${prefix}${planMirrorSlug(input.projectId, input.slug)}`;
  const artifacts = await listProjectArtifacts(input.userId, input.projectId);
  const match = artifacts.find((row) => row.pathname === pathname);
  if (!match) {
    // File may exist in Blob without a link — link and return.
    const content = await readPrivateBlobText(pathname);
    if (content === null) return null;
    const parsed = stripProjectFileFrontmatter(content);
    const artifact = await linkArtifactToProject(
      input.userId,
      input.projectId,
      pathname,
      parsed.title ?? input.slug,
    );
    if (!artifact) return null;
    return readProjectFileByArtifactId({
      userId: input.userId,
      projectId: input.projectId,
      artifactId: artifact.id,
    });
  }

  return readProjectFileByArtifactId({
    userId: input.userId,
    projectId: input.projectId,
    artifactId: match.id,
  });
}

/**
 * One-shot: for each legacy `plan` row (if the table still exists), write
 * Blob + project_artifact link. Safe to call repeatedly.
 */
export async function backfillPlansToProjectFiles(
  userId: string,
  projectId?: string,
): Promise<number> {
  const { db } = await import("@/lib/db/client");
  const { sql } = await import("drizzle-orm");

  try {
    const result = projectId
      ? await db.execute(sql`
          select id, project_id, title, slug, markdown
          from plan
          where user_id = ${userId} and project_id = ${projectId}
        `)
      : await db.execute(sql`
          select id, project_id, title, slug, markdown
          from plan
          where user_id = ${userId}
        `);

    const rows = (
      Array.isArray(result)
        ? result
        : ((result as { rows?: unknown }).rows ?? [])
    ) as Array<{
      id: string;
      project_id: string;
      title: string;
      slug: string;
      markdown: string;
    }>;

    let count = 0;
    for (const row of rows) {
      try {
        await putProjectMarkdownFile({
          userId,
          projectId: row.project_id,
          title: row.title,
          slug: row.slug,
          markdown: row.markdown,
        });
        count += 1;
      } catch {
        // Continue remaining rows.
      }
    }
    return count;
  } catch {
    // Table already dropped or unavailable.
    return 0;
  }
}

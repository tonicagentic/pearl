import { and, asc, eq, max } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { getProject } from "@/lib/db/projects";
import { projectLink, type ProjectLink } from "@/lib/db/schema";

const MAX_TITLE = 200;
const MAX_URL = 2_000;

export type ProjectLinkDto = {
  readonly id: string;
  readonly projectId: string;
  readonly title: string;
  readonly url: string;
  readonly sortOrder: number;
  readonly createdAt: string;
};

function toDto(row: ProjectLink): ProjectLinkDto {
  return {
    id: row.id,
    projectId: row.projectId,
    title: row.title,
    url: row.url,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
  };
}

function requireTitle(title: string): string {
  const trimmed = title.trim();
  if (!trimmed) throw new Error("A link needs a title.");
  if (trimmed.length > MAX_TITLE) {
    throw new Error(`Link titles must be ${MAX_TITLE} characters or fewer.`);
  }
  return trimmed;
}

function requireUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) throw new Error("A link needs a URL.");
  if (trimmed.length > MAX_URL) {
    throw new Error(`URLs must be ${MAX_URL} characters or fewer.`);
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("URL must be a valid http(s) address.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("URL must use http or https.");
  }
  return parsed.toString();
}

export async function listProjectLinks(
  userId: string,
  projectId: string,
): Promise<readonly ProjectLinkDto[]> {
  const owned = await getProject(userId, projectId);
  if (!owned) return [];

  const rows = await db
    .select()
    .from(projectLink)
    .where(
      and(
        eq(projectLink.projectId, projectId),
        eq(projectLink.userId, userId),
      ),
    )
    .orderBy(asc(projectLink.sortOrder), asc(projectLink.createdAt));

  return rows.map(toDto);
}

export async function getProjectLink(
  userId: string,
  projectId: string,
  linkId: string,
): Promise<ProjectLinkDto | null> {
  const [row] = await db
    .select()
    .from(projectLink)
    .where(
      and(
        eq(projectLink.id, linkId),
        eq(projectLink.projectId, projectId),
        eq(projectLink.userId, userId),
      ),
    )
    .limit(1);
  return row ? toDto(row) : null;
}

export async function createProjectLink(
  userId: string,
  projectId: string,
  input: { readonly title: string; readonly url: string },
): Promise<ProjectLinkDto | null> {
  const owned = await getProject(userId, projectId);
  if (!owned) return null;

  const title = requireTitle(input.title);
  const url = requireUrl(input.url);

  const [agg] = await db
    .select({ maxOrder: max(projectLink.sortOrder) })
    .from(projectLink)
    .where(
      and(
        eq(projectLink.projectId, projectId),
        eq(projectLink.userId, userId),
      ),
    );
  const sortOrder = (agg?.maxOrder ?? -1) + 1;

  const [row] = await db
    .insert(projectLink)
    .values({
      projectId,
      userId,
      title,
      url,
      sortOrder,
    })
    .returning();
  if (!row) throw new Error("Failed to create link.");
  return toDto(row);
}

export async function updateProjectLink(
  userId: string,
  projectId: string,
  linkId: string,
  input: { readonly title?: string; readonly url?: string },
): Promise<ProjectLinkDto | null> {
  const existing = await getProjectLink(userId, projectId, linkId);
  if (!existing) return null;

  const title =
    input.title !== undefined ? requireTitle(input.title) : existing.title;
  const url = input.url !== undefined ? requireUrl(input.url) : existing.url;

  const [row] = await db
    .update(projectLink)
    .set({ title, url })
    .where(
      and(
        eq(projectLink.id, linkId),
        eq(projectLink.projectId, projectId),
        eq(projectLink.userId, userId),
      ),
    )
    .returning();
  return row ? toDto(row) : null;
}

export async function deleteProjectLink(
  userId: string,
  projectId: string,
  linkId: string,
): Promise<boolean> {
  const deleted = await db
    .delete(projectLink)
    .where(
      and(
        eq(projectLink.id, linkId),
        eq(projectLink.projectId, projectId),
        eq(projectLink.userId, userId),
      ),
    )
    .returning({ id: projectLink.id });
  return deleted.length > 0;
}

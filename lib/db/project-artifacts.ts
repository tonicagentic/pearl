import { and, asc, eq, max } from "drizzle-orm";

import { artifactsPrefix } from "@/agent/lib/artifacts";
import { db } from "@/lib/db/client";
import { getProject } from "@/lib/db/projects";
import { project, projectArtifact } from "@/lib/db/schema";

export type ProjectArtifactDto = {
  readonly id: string;
  readonly projectId: string;
  readonly pathname: string;
  readonly title: string;
  readonly sortOrder: number;
  readonly createdAt: string;
};

function titleFromPathname(pathname: string, prefix: string): string {
  const basename = pathname.startsWith(prefix)
    ? pathname.slice(prefix.length)
    : pathname.split("/").pop() ?? pathname;
  return basename || pathname;
}

function toDto(row: typeof projectArtifact.$inferSelect): ProjectArtifactDto {
  return {
    id: row.id,
    projectId: row.projectId,
    pathname: row.pathname,
    title: row.title,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
  };
}

function viewerArtifactsPrefix(userId: string): string | null {
  return artifactsPrefix({
    principalId: userId,
    principalType: "user",
  });
}

export type ProjectArtifactLinkDto = {
  readonly pathname: string;
  readonly projectId: string;
  readonly projectName: string;
  readonly title: string;
};

/** All Library↔project links for a user (for Library project filters). */
export async function listUserProjectArtifactLinks(
  userId: string,
): Promise<readonly ProjectArtifactLinkDto[]> {
  const rows = await db
    .select({
      pathname: projectArtifact.pathname,
      projectId: projectArtifact.projectId,
      projectName: project.name,
      title: projectArtifact.title,
    })
    .from(projectArtifact)
    .innerJoin(project, eq(projectArtifact.projectId, project.id))
    .where(eq(projectArtifact.userId, userId))
    .orderBy(asc(project.name), asc(projectArtifact.sortOrder));

  return rows.map((row) => ({
    pathname: row.pathname,
    projectId: row.projectId,
    projectName: row.projectName,
    title: row.title,
  }));
}

export async function listProjectArtifacts(
  userId: string,
  projectId: string,
): Promise<readonly ProjectArtifactDto[]> {
  const owned = await getProject(userId, projectId);
  if (!owned) return [];

  const rows = await db
    .select()
    .from(projectArtifact)
    .where(
      and(
        eq(projectArtifact.projectId, projectId),
        eq(projectArtifact.userId, userId),
      ),
    )
    .orderBy(asc(projectArtifact.sortOrder), asc(projectArtifact.createdAt));

  return rows.map(toDto);
}

export async function getProjectArtifact(
  userId: string,
  projectId: string,
  artifactId: string,
): Promise<ProjectArtifactDto | null> {
  const [row] = await db
    .select()
    .from(projectArtifact)
    .where(
      and(
        eq(projectArtifact.id, artifactId),
        eq(projectArtifact.projectId, projectId),
        eq(projectArtifact.userId, userId),
      ),
    )
    .limit(1);
  return row ? toDto(row) : null;
}

export async function linkArtifactToProject(
  userId: string,
  projectId: string,
  pathname: string,
  title?: string,
): Promise<ProjectArtifactDto | null> {
  const owned = await getProject(userId, projectId);
  if (!owned) return null;

  const prefix = viewerArtifactsPrefix(userId);
  if (!prefix || !pathname.startsWith(prefix)) {
    throw new Error("pathname must be one of your library artifacts.");
  }

  const resolvedTitle =
    title?.trim() || titleFromPathname(pathname, prefix);

  const [existing] = await db
    .select()
    .from(projectArtifact)
    .where(
      and(
        eq(projectArtifact.projectId, projectId),
        eq(projectArtifact.pathname, pathname),
      ),
    )
    .limit(1);
  if (existing) {
    if (title?.trim() && existing.title !== resolvedTitle) {
      const [updated] = await db
        .update(projectArtifact)
        .set({ title: resolvedTitle })
        .where(eq(projectArtifact.id, existing.id))
        .returning();
      return updated ? toDto(updated) : toDto(existing);
    }
    return toDto(existing);
  }

  const [agg] = await db
    .select({ maxOrder: max(projectArtifact.sortOrder) })
    .from(projectArtifact)
    .where(eq(projectArtifact.projectId, projectId));
  const nextOrder = (agg?.maxOrder ?? -1) + 1;

  const [row] = await db
    .insert(projectArtifact)
    .values({
      projectId,
      userId,
      pathname,
      title: resolvedTitle,
      sortOrder: nextOrder,
    })
    .returning();
  if (!row) throw new Error("Failed to link artifact.");
  return toDto(row);
}

export async function updateProjectArtifactTitle(
  userId: string,
  projectId: string,
  artifactId: string,
  title: string,
): Promise<ProjectArtifactDto | null> {
  const trimmed = title.trim();
  if (!trimmed) throw new Error("A file needs a title.");

  const [row] = await db
    .update(projectArtifact)
    .set({ title: trimmed })
    .where(
      and(
        eq(projectArtifact.id, artifactId),
        eq(projectArtifact.projectId, projectId),
        eq(projectArtifact.userId, userId),
      ),
    )
    .returning();
  return row ? toDto(row) : null;
}

export async function unlinkArtifactFromProject(
  userId: string,
  projectId: string,
  artifactLinkId: string,
): Promise<boolean> {
  const owned = await getProject(userId, projectId);
  if (!owned) return false;

  const deleted = await db
    .delete(projectArtifact)
    .where(
      and(
        eq(projectArtifact.id, artifactLinkId),
        eq(projectArtifact.projectId, projectId),
        eq(projectArtifact.userId, userId),
      ),
    )
    .returning({ id: projectArtifact.id });
  return deleted.length > 0;
}

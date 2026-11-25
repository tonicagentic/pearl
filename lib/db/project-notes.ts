import { and, desc, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { getProject } from "@/lib/db/projects";
import { projectNote, type ProjectNote } from "@/lib/db/schema";

const MAX_TITLE = 200;
const MAX_MARKDOWN = 200_000;

export type ProjectNoteDto = {
  readonly id: string;
  readonly projectId: string;
  readonly title: string;
  readonly markdown: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type ProjectNoteSummaryDto = {
  readonly id: string;
  readonly projectId: string;
  readonly title: string;
  readonly updatedAt: string;
};

function toDto(row: ProjectNote): ProjectNoteDto {
  return {
    id: row.id,
    projectId: row.projectId,
    title: row.title,
    markdown: row.markdown,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toSummary(row: ProjectNote): ProjectNoteSummaryDto {
  return {
    id: row.id,
    projectId: row.projectId,
    title: row.title,
    updatedAt: row.updatedAt.toISOString(),
  };
}

function requireTitle(title: string): string {
  const trimmed = title.trim();
  if (!trimmed) throw new Error("A note needs a title.");
  if (trimmed.length > MAX_TITLE) {
    throw new Error(`Note titles must be ${MAX_TITLE} characters or fewer.`);
  }
  return trimmed;
}

export async function listProjectNotes(
  userId: string,
  projectId: string,
): Promise<readonly ProjectNoteSummaryDto[]> {
  const owned = await getProject(userId, projectId);
  if (!owned) return [];

  const rows = await db
    .select()
    .from(projectNote)
    .where(
      and(
        eq(projectNote.projectId, projectId),
        eq(projectNote.userId, userId),
      ),
    )
    .orderBy(desc(projectNote.updatedAt));

  return rows.map(toSummary);
}

export async function getProjectNote(
  userId: string,
  projectId: string,
  noteId: string,
): Promise<ProjectNoteDto | null> {
  const [row] = await db
    .select()
    .from(projectNote)
    .where(
      and(
        eq(projectNote.id, noteId),
        eq(projectNote.projectId, projectId),
        eq(projectNote.userId, userId),
      ),
    )
    .limit(1);
  return row ? toDto(row) : null;
}

export async function createProjectNote(
  userId: string,
  projectId: string,
  input: {
    readonly title: string;
    readonly markdown?: string;
  },
): Promise<ProjectNoteDto | null> {
  const owned = await getProject(userId, projectId);
  if (!owned) return null;

  const title = requireTitle(input.title);
  const markdown = (input.markdown ?? "").slice(0, MAX_MARKDOWN);

  const [row] = await db
    .insert(projectNote)
    .values({
      userId,
      projectId,
      title,
      markdown,
    })
    .returning();
  if (!row) throw new Error("Failed to create note.");
  return toDto(row);
}

export async function updateProjectNote(
  userId: string,
  projectId: string,
  noteId: string,
  input: {
    readonly title?: string;
    readonly markdown?: string;
  },
): Promise<ProjectNoteDto | null> {
  const existing = await getProjectNote(userId, projectId, noteId);
  if (!existing) return null;

  const title =
    input.title !== undefined ? requireTitle(input.title) : existing.title;
  const markdown =
    input.markdown !== undefined
      ? input.markdown.slice(0, MAX_MARKDOWN)
      : existing.markdown;

  const [row] = await db
    .update(projectNote)
    .set({
      title,
      markdown,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(projectNote.id, noteId),
        eq(projectNote.projectId, projectId),
        eq(projectNote.userId, userId),
      ),
    )
    .returning();
  return row ? toDto(row) : null;
}

export async function deleteProjectNote(
  userId: string,
  projectId: string,
  noteId: string,
): Promise<boolean> {
  const deleted = await db
    .delete(projectNote)
    .where(
      and(
        eq(projectNote.id, noteId),
        eq(projectNote.projectId, projectId),
        eq(projectNote.userId, userId),
      ),
    )
    .returning({ id: projectNote.id });
  return deleted.length > 0;
}

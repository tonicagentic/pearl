import { and, desc, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { getGoal } from "@/lib/db/project-goals";
import { getProject } from "@/lib/db/projects";
import { project, projectNote, type ProjectNote } from "@/lib/db/schema";

const MAX_TITLE = 200;
const MAX_MARKDOWN = 200_000;

export type ProjectNoteDto = {
  readonly id: string;
  readonly projectId: string | null;
  readonly projectName: string | null;
  readonly goalId: string | null;
  readonly title: string;
  readonly markdown: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type ProjectNoteSummaryDto = {
  readonly id: string;
  readonly projectId: string | null;
  readonly projectName: string | null;
  readonly goalId: string | null;
  readonly title: string;
  readonly updatedAt: string;
};

function toDto(
  row: ProjectNote,
  projectName: string | null = null,
): ProjectNoteDto {
  return {
    id: row.id,
    projectId: row.projectId,
    projectName,
    goalId: row.goalId,
    title: row.title,
    markdown: row.markdown,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toSummary(
  row: ProjectNote,
  projectName: string | null = null,
): ProjectNoteSummaryDto {
  return {
    id: row.id,
    projectId: row.projectId,
    projectName,
    goalId: row.goalId,
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

async function resolveOptionalProjectId(
  userId: string,
  projectId: string | null | undefined,
): Promise<string | null> {
  if (projectId === undefined || projectId === null || projectId.trim() === "") {
    return null;
  }
  const owned = await getProject(userId, projectId.trim());
  if (!owned) throw new Error("Unknown project.");
  return owned.id;
}

async function resolveOptionalGoalId(
  userId: string,
  goalId: string | null | undefined,
): Promise<string | null> {
  if (goalId === undefined || goalId === null || goalId.trim() === "") {
    return null;
  }
  const owned = await getGoal(userId, goalId.trim());
  if (!owned) throw new Error("Unknown goal.");
  return owned.id;
}

export async function listAllNotes(
  userId: string,
): Promise<readonly ProjectNoteSummaryDto[]> {
  const rows = await db
    .select({
      note: projectNote,
      projectName: project.name,
    })
    .from(projectNote)
    .leftJoin(project, eq(projectNote.projectId, project.id))
    .where(eq(projectNote.userId, userId))
    .orderBy(desc(projectNote.updatedAt));

  return rows.map((row) => toSummary(row.note, row.projectName ?? null));
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

  return rows.map((row) => toSummary(row, owned.name));
}

export async function listGoalNotes(
  userId: string,
  goalId: string,
): Promise<readonly ProjectNoteSummaryDto[]> {
  const owned = await getGoal(userId, goalId);
  if (!owned) return [];

  const rows = await db
    .select({
      note: projectNote,
      projectName: project.name,
    })
    .from(projectNote)
    .leftJoin(project, eq(projectNote.projectId, project.id))
    .where(
      and(eq(projectNote.goalId, goalId), eq(projectNote.userId, userId)),
    )
    .orderBy(desc(projectNote.updatedAt));

  return rows.map((row) => toSummary(row.note, row.projectName ?? null));
}

export async function getNote(
  userId: string,
  noteId: string,
): Promise<ProjectNoteDto | null> {
  const [row] = await db
    .select({
      note: projectNote,
      projectName: project.name,
    })
    .from(projectNote)
    .leftJoin(project, eq(projectNote.projectId, project.id))
    .where(and(eq(projectNote.id, noteId), eq(projectNote.userId, userId)))
    .limit(1);
  return row ? toDto(row.note, row.projectName ?? null) : null;
}

export async function getProjectNote(
  userId: string,
  projectId: string,
  noteId: string,
): Promise<ProjectNoteDto | null> {
  const note = await getNote(userId, noteId);
  if (!note || note.projectId !== projectId) return null;
  return note;
}

export async function createNote(
  userId: string,
  input: {
    readonly title: string;
    readonly markdown?: string;
    readonly projectId?: string | null;
    readonly goalId?: string | null;
  },
): Promise<ProjectNoteDto> {
  const projectId = await resolveOptionalProjectId(userId, input.projectId);
  const goalId = await resolveOptionalGoalId(userId, input.goalId);
  const title = requireTitle(input.title);
  const markdown = (input.markdown ?? "").slice(0, MAX_MARKDOWN);

  const [row] = await db
    .insert(projectNote)
    .values({
      userId,
      projectId,
      goalId,
      title,
      markdown,
    })
    .returning();
  if (!row) throw new Error("Failed to create note.");

  let projectName: string | null = null;
  if (projectId) {
    const owned = await getProject(userId, projectId);
    projectName = owned?.name ?? null;
  }
  return toDto(row, projectName);
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
  return createNote(userId, { ...input, projectId });
}

export async function updateNote(
  userId: string,
  noteId: string,
  input: {
    readonly title?: string;
    readonly markdown?: string;
    readonly projectId?: string | null;
    readonly goalId?: string | null;
  },
): Promise<ProjectNoteDto | null> {
  const existing = await getNote(userId, noteId);
  if (!existing) return null;

  const title =
    input.title !== undefined ? requireTitle(input.title) : existing.title;
  const markdown =
    input.markdown !== undefined
      ? input.markdown.slice(0, MAX_MARKDOWN)
      : existing.markdown;
  const projectId =
    input.projectId !== undefined
      ? await resolveOptionalProjectId(userId, input.projectId)
      : existing.projectId;
  const goalId =
    input.goalId !== undefined
      ? await resolveOptionalGoalId(userId, input.goalId)
      : existing.goalId;

  const [row] = await db
    .update(projectNote)
    .set({
      title,
      markdown,
      projectId,
      goalId,
      updatedAt: new Date(),
    })
    .where(and(eq(projectNote.id, noteId), eq(projectNote.userId, userId)))
    .returning();
  if (!row) return null;

  let projectName: string | null = null;
  if (row.projectId) {
    const owned = await getProject(userId, row.projectId);
    projectName = owned?.name ?? null;
  }
  return toDto(row, projectName);
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
  return updateNote(userId, noteId, input);
}

export async function deleteNote(
  userId: string,
  noteId: string,
): Promise<boolean> {
  const deleted = await db
    .delete(projectNote)
    .where(and(eq(projectNote.id, noteId), eq(projectNote.userId, userId)))
    .returning({ id: projectNote.id });
  return deleted.length > 0;
}

export async function deleteProjectNote(
  userId: string,
  projectId: string,
  noteId: string,
): Promise<boolean> {
  const existing = await getProjectNote(userId, projectId, noteId);
  if (!existing) return false;
  return deleteNote(userId, noteId);
}

"use server";

import { revalidatePath } from "next/cache";

import {
  createIssue,
  createArea,
  deleteIssue,
  getIssue,
  getArea,
  findAreaByName,
  reopenIssue,
  resolveIssue,
  updateIssue,
} from "@/lib/db/issues";
import { getProject } from "@/lib/db/projects";
import { getServerViewer } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isoDateOrNull(value: unknown): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === "") {
    return null;
  }

  return typeof value === "string" && ISO_DATE.test(value) ? value : undefined;
}

async function requireViewer() {
  const setupStatus = await getSetupStatus();

  if (setupStatus.storageMode !== "database") {
    throw new Error("Database persistence is not enabled.");
  }

  const viewer = await getServerViewer(setupStatus);

  if (!viewer) {
    throw new Error("Sign in to continue.");
  }

  return viewer;
}

function revalidateIssues(projectId?: string | null) {
  revalidatePath("/tasks");
  if (projectId) {
    revalidatePath(`/projects/${projectId}`);
  }
}

export type IssueActionInput = {
  readonly title?: string;
  readonly description?: string | null;
  readonly areaId?: string;
  readonly areaName?: string;
  readonly projectId?: string | null;
  readonly dueDate?: string | null;
  readonly reviewDate?: string | null;
};

/** Create an issue, resolving `areaName` case-insensitively. */
export async function createIssueAction(input: IssueActionInput) {
  const viewer = await requireViewer();

  const title = input.title?.trim();

  if (!title) {
    throw new Error("An issue needs a title.");
  }

  const areaId = await (async () => {
    if (input.areaId) {
      const known = await getArea(viewer.id, input.areaId);

      if (!known) {
        throw new Error("Unknown area.");
      }

      return known.id;
    }

    if (input.areaName) {
      const name = input.areaName.trim();
      const existing = await findAreaByName(viewer.id, name);

      return existing?.id ?? (await createArea(viewer.id, name)).id;
    }

    return undefined;
  })();

  if (!areaId) {
    throw new Error("An issue needs a area to attach to.");
  }

  const dueDate = isoDateOrNull(input.dueDate);
  const reviewDate = isoDateOrNull(input.reviewDate);

  if (dueDate === undefined || reviewDate === undefined) {
    throw new Error("Dates must be YYYY-MM-DD.");
  }

  let projectId: string | null = null;
  if (input.projectId !== undefined && input.projectId !== null && input.projectId !== "") {
    const owned = await getProject(viewer.id, input.projectId);
    if (!owned) throw new Error("Unknown project.");
    projectId = owned.id;
  }

  const issue = await createIssue(viewer.id, {
    title,
    description: input.description?.trim() || null,
    areaId,
    projectId,
    dueDate,
    reviewDate,
  });

  revalidateIssues(projectId);

  return issue;
}

export async function updateIssueAction(id: string, input: IssueActionInput) {
  const viewer = await requireViewer();

  const dueDate = isoDateOrNull(input.dueDate);
  const reviewDate = isoDateOrNull(input.reviewDate);

  if (dueDate === undefined || reviewDate === undefined) {
    throw new Error("Dates must be YYYY-MM-DD.");
  }

  if (input.areaId) {
    const area = await getArea(viewer.id, input.areaId);

    if (!area) {
      throw new Error("Unknown area.");
    }
  }

  await updateIssue(viewer.id, id, {
    ...(input.title !== undefined ? { title: input.title.trim() } : {}),
    ...(input.description !== undefined
      ? { description: (input.description ?? "").trim() || null }
      : {}),
    ...(input.areaId !== undefined
      ? { areaId: input.areaId }
      : {}),
    ...(dueDate !== undefined ? { dueDate } : {}),
    ...(reviewDate !== undefined ? { reviewDate } : {}),
  });

  revalidateIssues();
}

export async function resolveIssueAction(id: string) {
  const viewer = await requireViewer();

  const issue = await getIssue(viewer.id, id);

  if (!issue) {
    throw new Error("Issue not found.");
  }

  await resolveIssue(viewer.id, id);
  revalidateIssues();
}

export async function reopenIssueAction(id: string) {
  const viewer = await requireViewer();
  await reopenIssue(viewer.id, id);
  revalidateIssues();
}

export async function deleteIssueAction(id: string) {
  const viewer = await requireViewer();

  const issue = await getIssue(viewer.id, id);

  if (!issue) {
    throw new Error("Issue not found.");
  }

  await deleteIssue(viewer.id, id);
  revalidateIssues();
}


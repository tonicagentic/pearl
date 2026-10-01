"use server";

import { revalidatePath } from "next/cache";

import {
  createIssue,
  createArea,
  deleteAreaIfSettled,
  getIssue,
  getArea,
  findAreaByName,
  renameArea,
  reopenIssue,
  resolveIssue,
  updateIssue,
} from "@/lib/db/issues";
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

function revalidateIssues() {
  revalidatePath("/issues");
  revalidatePath("/settings/areas");
}

export type IssueActionInput = {
  readonly title?: string;
  readonly description?: string | null;
  readonly areaId?: string;
  readonly areaName?: string;
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

  const issue = await createIssue(viewer.id, {
    title,
    description: input.description?.trim() || null,
    areaId,
    dueDate,
    reviewDate,
  });

  revalidateIssues();

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

export type AreaActionInput = {
  readonly name?: string;
  readonly parentId?: string | null;
};

export async function createAreaAction(
  input: AreaActionInput,
) {
  const viewer = await requireViewer();

  const name = input.name?.trim();

  if (!name) {
    throw new Error("A area needs a name.");
  }

  const parentId = input.parentId ?? null;

  if (parentId) {
    const parent = await getArea(viewer.id, parentId);

    if (!parent) {
      throw new Error("Unknown parent area.");
    }
  }

  const row = await createArea(viewer.id, name, parentId);
  revalidateIssues();

  return row;
}

export async function renameAreaAction(
  id: string,
  input: { readonly name?: string },
) {
  const viewer = await requireViewer();

  const name = input.name?.trim();

  if (!name) {
    throw new Error("A area needs a name.");
  }

  await renameArea(viewer.id, id, name);
  revalidateIssues();
}

export async function deleteAreaAction(id: string) {
  const viewer = await requireViewer();

  const result = await deleteAreaIfSettled(viewer.id, id);

  if (!result.deleted) {
    throw new Error(
      result.openIssues === 1
        ? "This area still has 1 open issue. Resolve it or move it first."
        : `This area still has ${result.openIssues} open issues. Resolve them or move them first.`,
    );
  }

  revalidateIssues();
}

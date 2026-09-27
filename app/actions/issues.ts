"use server";

import { revalidatePath } from "next/cache";

import {
  createIssue,
  createResponsibility,
  deleteResponsibilityIfSettled,
  getIssue,
  getResponsibility,
  findResponsibilityByName,
  renameResponsibility,
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
  revalidatePath("/settings/responsibilities");
}

export type IssueActionInput = {
  readonly title?: string;
  readonly description?: string | null;
  readonly responsibilityId?: string;
  readonly responsibilityName?: string;
  readonly dueDate?: string | null;
  readonly reviewDate?: string | null;
};

/** Create an issue, resolving `responsibilityName` case-insensitively. */
export async function createIssueAction(input: IssueActionInput) {
  const viewer = await requireViewer();

  const title = input.title?.trim();

  if (!title) {
    throw new Error("An issue needs a title.");
  }

  const responsibilityId = await (async () => {
    if (input.responsibilityId) {
      const known = await getResponsibility(viewer.id, input.responsibilityId);

      if (!known) {
        throw new Error("Unknown responsibility.");
      }

      return known.id;
    }

    if (input.responsibilityName) {
      const name = input.responsibilityName.trim();
      const existing = await findResponsibilityByName(viewer.id, name);

      return existing?.id ?? (await createResponsibility(viewer.id, name)).id;
    }

    return undefined;
  })();

  if (!responsibilityId) {
    throw new Error("An issue needs a responsibility to attach to.");
  }

  const dueDate = isoDateOrNull(input.dueDate);
  const reviewDate = isoDateOrNull(input.reviewDate);

  if (dueDate === undefined || reviewDate === undefined) {
    throw new Error("Dates must be YYYY-MM-DD.");
  }

  const issue = await createIssue(viewer.id, {
    title,
    description: input.description?.trim() || null,
    responsibilityId,
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

  if (input.responsibilityId) {
    const responsibility = await getResponsibility(viewer.id, input.responsibilityId);

    if (!responsibility) {
      throw new Error("Unknown responsibility.");
    }
  }

  await updateIssue(viewer.id, id, {
    ...(input.title !== undefined ? { title: input.title.trim() } : {}),
    ...(input.description !== undefined
      ? { description: (input.description ?? "").trim() || null }
      : {}),
    ...(input.responsibilityId !== undefined
      ? { responsibilityId: input.responsibilityId }
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

export type ResponsibilityActionInput = {
  readonly name?: string;
  readonly parentId?: string | null;
};

export async function createResponsibilityAction(
  input: ResponsibilityActionInput,
) {
  const viewer = await requireViewer();

  const name = input.name?.trim();

  if (!name) {
    throw new Error("A responsibility needs a name.");
  }

  const parentId = input.parentId ?? null;

  if (parentId) {
    const parent = await getResponsibility(viewer.id, parentId);

    if (!parent) {
      throw new Error("Unknown parent responsibility.");
    }
  }

  const row = await createResponsibility(viewer.id, name, parentId);
  revalidateIssues();

  return row;
}

export async function renameResponsibilityAction(
  id: string,
  input: { readonly name?: string },
) {
  const viewer = await requireViewer();

  const name = input.name?.trim();

  if (!name) {
    throw new Error("A responsibility needs a name.");
  }

  await renameResponsibility(viewer.id, id, name);
  revalidateIssues();
}

export async function deleteResponsibilityAction(id: string) {
  const viewer = await requireViewer();

  const result = await deleteResponsibilityIfSettled(viewer.id, id);

  if (!result.deleted) {
    throw new Error(
      result.openIssues === 1
        ? "This area still has 1 open issue. Resolve it or move it first."
        : `This area still has ${result.openIssues} open issues. Resolve them or move them first.`,
    );
  }

  revalidateIssues();
}

"use server";

import { revalidatePath } from "next/cache";

import {
  createProject,
  deletePlan,
  deleteProject,
  getChatProjectId,
  getPlan,
  getProject,
  listPlans,
  listProjectChats,
  listProjects,
  savePlan,
  setChatProject,
  updateProject,
} from "@/lib/db/projects";
import { createChat } from "@/lib/db/queries";
import { ensureUserForPrincipal } from "@/lib/db/issues";
import { getServerViewer } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";

async function requireDatabaseViewer() {
  const setup = await getSetupStatus();
  const viewer = await getServerViewer(setup);
  if (!viewer || setup.storageMode !== "database") {
    throw new Error("Sign in with durable storage to manage projects.");
  }
  await ensureUserForPrincipal({
    principalId: viewer.id,
    attributes: { name: viewer.name, email: viewer.email },
  });
  return viewer;
}

function revalidateProjectPaths(projectId?: string, planId?: string) {
  revalidatePath("/projects");
  if (projectId) {
    revalidatePath(`/projects/${projectId}`);
    if (planId) {
      revalidatePath(`/projects/${projectId}/plans/${planId}`);
    }
  }
}

export async function listProjectsAction() {
  const viewer = await requireDatabaseViewer();
  return listProjects(viewer.id);
}

export async function createProjectAction(input: {
  readonly name: string;
  readonly instructions?: string;
}) {
  const viewer = await requireDatabaseViewer();
  const row = await createProject(viewer.id, input);
  revalidateProjectPaths(row.id);
  return row;
}

export async function updateProjectAction(input: {
  readonly projectId: string;
  readonly name?: string;
  readonly instructions?: string;
}) {
  const viewer = await requireDatabaseViewer();
  const row = await updateProject(viewer.id, input.projectId, input);
  if (!row) throw new Error("Unknown project.");
  revalidateProjectPaths(row.id);
  return row;
}

export async function deleteProjectAction(input: {
  readonly projectId: string;
}) {
  const viewer = await requireDatabaseViewer();
  const ok = await deleteProject(viewer.id, input.projectId);
  if (!ok) throw new Error("Unknown project.");
  revalidateProjectPaths();
  return { ok: true as const };
}

export async function savePlanAction(input: {
  readonly projectId: string;
  readonly title: string;
  readonly markdown: string;
  readonly slug?: string;
  readonly planId?: string;
}) {
  const viewer = await requireDatabaseViewer();
  const row = await savePlan(viewer.id, input);
  revalidateProjectPaths(row.projectId, row.id);
  return row;
}

export async function deletePlanAction(input: { readonly planId: string }) {
  const viewer = await requireDatabaseViewer();
  const existing = await getPlan(viewer.id, input.planId);
  if (!existing) throw new Error("Unknown plan.");
  await deletePlan(viewer.id, input.planId);
  revalidateProjectPaths(existing.projectId);
  return { ok: true as const };
}

export async function attachChatToProjectAction(input: {
  readonly chatId: string;
  readonly projectId: string;
}) {
  const viewer = await requireDatabaseViewer();
  const ok = await setChatProject(viewer.id, input.chatId, input.projectId);
  if (!ok) throw new Error("Could not attach chat to project.");
  revalidateProjectPaths(input.projectId);
  return { ok: true as const, projectId: input.projectId };
}

export async function getChatProjectIdAction(input: {
  readonly chatId: string;
}) {
  const viewer = await requireDatabaseViewer();
  return getChatProjectId(viewer.id, input.chatId);
}

/** Start an Agent-mode chat that asks Pearl to carry out a plan. */
export async function carryOutPlanAction(input: {
  readonly planId: string;
}) {
  const viewer = await requireDatabaseViewer();
  const existing = await getPlan(viewer.id, input.planId);
  if (!existing) throw new Error("Unknown plan.");

  const owned = await getProject(viewer.id, existing.projectId);
  if (!owned) throw new Error("Unknown project.");

  const message =
    `Carry out the plan "${existing.title}" (id: ${existing.id}). ` +
    `Call read_plan first, then do what it says.`;

  const created = await createChat(viewer.id, {
    pendingUserMessage: message,
    projectId: existing.projectId,
  });

  revalidateProjectPaths(existing.projectId, existing.id);
  return { chatId: created.id, projectId: existing.projectId };
}

export async function createProjectChatAction(input: {
  readonly projectId: string;
}) {
  const viewer = await requireDatabaseViewer();
  const owned = await getProject(viewer.id, input.projectId);
  if (!owned) throw new Error("Unknown project.");
  const created = await createChat(viewer.id, {
    projectId: input.projectId,
  });
  revalidateProjectPaths(input.projectId);
  return created;
}

export async function loadProjectWorkspaceAction(input: {
  readonly projectId: string;
}) {
  const viewer = await requireDatabaseViewer();
  const owned = await getProject(viewer.id, input.projectId);
  if (!owned) return null;
  const [plans, chats] = await Promise.all([
    listPlans(viewer.id, owned.id),
    listProjectChats(viewer.id, owned.id),
  ]);
  return { project: owned, plans, chats };
}

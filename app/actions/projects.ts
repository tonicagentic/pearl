"use server";

import { revalidatePath } from "next/cache";

import {
  createProject,
  deleteProject,
  getChatProjectId,
  getProject,
  listProjectChats,
  listProjects,
  setChatProject,
  updateProject,
} from "@/lib/db/projects";
import {
  linkArtifactToProject,
  listProjectArtifacts,
  unlinkArtifactFromProject,
} from "@/lib/db/project-artifacts";
import { createChat } from "@/lib/db/queries";
import {
  ensureUserForPrincipal,
  listProjectIssues,
} from "@/lib/db/issues";
import {
  createWorkbenchPin,
  linkPinToProject,
  listProjectPins,
  unlinkPinFromProject,
} from "@/lib/db/workbench-pins";
import {
  putProjectMarkdownFile,
  readProjectFileByArtifactId,
} from "@/lib/project-files";
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

function revalidateProjectPaths(projectId?: string) {
  revalidatePath("/projects");
  if (projectId) {
    revalidatePath(`/projects/${projectId}`);
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
  readonly status?:
    | "backlog"
    | "planned"
    | "in_progress"
    | "completed"
    | "canceled";
  readonly priority?: "none" | "urgent" | "high" | "medium" | "low";
  readonly startDate?: string | null;
  readonly targetDate?: string | null;
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

/** Create a markdown project file (replaces savePlanAction). */
export async function saveProjectFileAction(input: {
  readonly projectId: string;
  readonly title: string;
  readonly markdown?: string;
  readonly slug?: string;
}) {
  const viewer = await requireDatabaseViewer();
  const written = await putProjectMarkdownFile({
    userId: viewer.id,
    projectId: input.projectId,
    title: input.title,
    markdown: input.markdown,
    slug: input.slug,
  });
  revalidateProjectPaths(input.projectId);
  return written.artifact;
}

/** @deprecated Use saveProjectFileAction. */
export async function savePlanAction(input: {
  readonly projectId: string;
  readonly title: string;
  readonly markdown: string;
  readonly slug?: string;
  readonly planId?: string;
}) {
  return saveProjectFileAction(input);
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

export async function detachChatFromProjectAction(input: {
  readonly chatId: string;
  readonly projectId: string;
}) {
  const viewer = await requireDatabaseViewer();
  const ok = await setChatProject(viewer.id, input.chatId, null);
  if (!ok) throw new Error("Could not unlink chat from project.");
  revalidateProjectPaths(input.projectId);
  return { ok: true as const };
}

export async function getChatProjectIdAction(input: {
  readonly chatId: string;
}) {
  const viewer = await requireDatabaseViewer();
  return getChatProjectId(viewer.id, input.chatId);
}

/** Start an Agent-mode chat that asks Pearl to carry out a project file. */
export async function carryOutProjectFileAction(input: {
  readonly projectId: string;
  readonly artifactId: string;
}) {
  const viewer = await requireDatabaseViewer();
  const file = await readProjectFileByArtifactId({
    userId: viewer.id,
    projectId: input.projectId,
    artifactId: input.artifactId,
  });
  if (!file) throw new Error("Unknown project file.");

  const message =
    `Carry out the plan "${file.title}" at ${file.path}. ` +
    `Call read_project_file (or read_file) on that path first, then do what it says.`;

  const created = await createChat(viewer.id, {
    pendingUserMessage: message,
    projectId: input.projectId,
  });

  revalidateProjectPaths(input.projectId);
  return { chatId: created.id, projectId: input.projectId };
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
  const [chats, pins, issues, artifacts] = await Promise.all([
    listProjectChats(viewer.id, owned.id),
    listProjectPins(viewer.id, owned.id),
    listProjectIssues(viewer.id, owned.id),
    listProjectArtifacts(viewer.id, owned.id),
  ]);
  return { project: owned, plans: [], chats, pins, issues, artifacts };
}

export async function linkProjectPinAction(input: {
  readonly projectId: string;
  readonly pinId?: string;
  readonly owner?: string;
  readonly name?: string;
  readonly fullName?: string;
  readonly vercelProjectId?: string | null;
  readonly vercelTeamId?: string | null;
  readonly expoProjectId?: string | null;
  readonly expoUpdateChannel?: string | null;
}) {
  const viewer = await requireDatabaseViewer();
  const owned = await getProject(viewer.id, input.projectId);
  if (!owned) throw new Error("Unknown project.");

  let pinId = input.pinId?.trim();
  if (!pinId) {
    const created = await createWorkbenchPin(viewer.id, {
      owner: input.owner,
      name: input.name,
      fullName: input.fullName,
      vercelProjectId: input.vercelProjectId,
      vercelTeamId: input.vercelTeamId,
      expoProjectId: input.expoProjectId,
      expoUpdateChannel: input.expoUpdateChannel,
    });
    pinId = created.id;
  }

  const linked = await linkPinToProject(viewer.id, input.projectId, pinId);
  if (!linked) throw new Error("Pin not found or could not be linked.");
  revalidateProjectPaths(input.projectId);
  return linked;
}

export async function unlinkProjectPinAction(input: {
  readonly projectId: string;
  readonly pinId: string;
}) {
  const viewer = await requireDatabaseViewer();
  const unlinked = await unlinkPinFromProject(
    viewer.id,
    input.projectId,
    input.pinId,
  );
  if (!unlinked) throw new Error("Pin not linked to this project.");
  revalidateProjectPaths(input.projectId);
  return { ok: true as const };
}

export async function linkProjectArtifactAction(input: {
  readonly projectId: string;
  readonly pathname: string;
}) {
  const viewer = await requireDatabaseViewer();
  const linked = await linkArtifactToProject(
    viewer.id,
    input.projectId,
    input.pathname,
  );
  if (!linked) throw new Error("Unknown project.");
  revalidateProjectPaths(input.projectId);
  return linked;
}

export async function unlinkProjectArtifactAction(input: {
  readonly projectId: string;
  readonly artifactId: string;
}) {
  const viewer = await requireDatabaseViewer();
  const ok = await unlinkArtifactFromProject(
    viewer.id,
    input.projectId,
    input.artifactId,
  );
  if (!ok) throw new Error("Linked artifact not found.");
  revalidateProjectPaths(input.projectId);
  return { ok: true as const };
}

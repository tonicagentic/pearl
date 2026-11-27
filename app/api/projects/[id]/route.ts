import { NextResponse } from "next/server";

import { listCustomAgents } from "@/lib/custom-agents/store";
import { listProjectIssues } from "@/lib/db/issues";
import {
  deleteProject,
  getProject,
  listProjectChats,
  updateProject,
} from "@/lib/db/projects";
import { listProjectArtifacts } from "@/lib/db/project-artifacts";
import { listProjectGoals } from "@/lib/db/project-goals";
import { listLabelsForProject } from "@/lib/db/project-labels";
import { listProjectLinks } from "@/lib/db/project-links";
import { listProjectNotes } from "@/lib/db/project-notes";
import { listProjectPins } from "@/lib/db/workbench-pins";
import { issueState, todayIso } from "@/lib/issues";
import { backfillPlansToProjectFiles } from "@/lib/project-files";
import { serializeProject } from "@/lib/projects/serialize";
import type { ProjectPriority, ProjectStatus } from "@/lib/db/schema";
import { getServerViewer } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";

async function requireViewer(request?: Request) {
  const setupStatus = await getSetupStatus();
  const viewer = await getServerViewer(setupStatus, request?.headers);
  if (!viewer || setupStatus.storageMode !== "database") {
    return null;
  }
  return viewer;
}

/** Project detail: project + tasks + goals + notes + files + chats + pins + links. */
export async function GET(
  request: Request,
  context: { readonly params: Promise<{ readonly id: string }> },
) {
  const viewer = await requireViewer(request);
  if (!viewer) {
    return NextResponse.json(
      { error: "Sign in with durable storage configured." },
      { status: 401 },
    );
  }

  const { id } = await context.params;
  const owned = await getProject(viewer.id, id);
  if (!owned) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  // Best-effort migration while `plan` table still exists pre-0058.
  await backfillPlansToProjectFiles(viewer.id, owned.id).catch(() => 0);

  const [chats, pins, issues, artifacts, goals, notes, links, agents, labels] =
    await Promise.all([
      listProjectChats(viewer.id, owned.id),
      listProjectPins(viewer.id, owned.id),
      listProjectIssues(viewer.id, owned.id),
      listProjectArtifacts(viewer.id, owned.id),
      listProjectGoals(viewer.id, owned.id),
      listProjectNotes(viewer.id, owned.id),
      listProjectLinks(viewer.id, owned.id),
      listCustomAgents(viewer.id, { projectId: owned.id }),
      listLabelsForProject(viewer.id, owned.id),
    ]);

  return NextResponse.json({
    project: serializeProject(owned, labels),
    // plans removed: project files live in artifacts (Blob + project_artifact).
    plans: [],
    agents,
    chats: chats.map((row) => ({
      id: row.id,
      title: row.title,
      updatedAt: row.updatedAt.toISOString(),
    })),
    pins: pins.map((pin) => ({
      id: pin.id,
      userId: pin.userId,
      owner: pin.owner,
      name: pin.name,
      fullName: pin.fullName,
      vercelProjectId: pin.vercelProjectId ?? null,
      vercelTeamId: pin.vercelTeamId ?? null,
      expoProjectId: pin.expoProjectId ?? null,
      expoUpdateChannel: pin.expoUpdateChannel ?? null,
      createdAt: pin.createdAt,
      updatedAt: pin.updatedAt,
    })),
    issues: issues.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      status: row.status,
      dueDate: row.dueDate,
      reviewDate: row.reviewDate,
      createdAt: row.createdAt.toISOString(),
      resolvedAt: row.resolvedAt?.toISOString() ?? null,
      areaId: row.areaId,
      areaName: row.areaName,
      projectId: row.projectId,
      goalId: row.goalId,
      state: issueState(row),
      dueSoon:
        row.status === "open" &&
        row.dueDate !== null &&
        row.dueDate <= todayIso(),
    })),
    artifacts,
    goals,
    notes,
    links,
  });
}

export async function PATCH(
  request: Request,
  context: { readonly params: Promise<{ readonly id: string }> },
) {
  const viewer = await requireViewer();
  if (!viewer) {
    return NextResponse.json(
      { error: "Sign in with durable storage configured." },
      { status: 401 },
    );
  }

  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    readonly name?: string;
    readonly instructions?: string;
    readonly status?: ProjectStatus;
    readonly priority?: ProjectPriority;
    readonly startDate?: string | null;
    readonly targetDate?: string | null;
  };

  try {
    const project = await updateProject(viewer.id, id, body);
    if (!project) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }
    const labels = await listLabelsForProject(viewer.id, id);
    return NextResponse.json({ project: serializeProject(project, labels) });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to update project.",
      },
      { status: 400 },
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { readonly params: Promise<{ readonly id: string }> },
) {
  const viewer = await requireViewer();
  if (!viewer) {
    return NextResponse.json(
      { error: "Sign in with durable storage configured." },
      { status: 401 },
    );
  }

  const { id } = await context.params;
  const deleted = await deleteProject(viewer.id, id);
  if (!deleted) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

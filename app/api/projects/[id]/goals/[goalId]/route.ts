import { NextResponse } from "next/server";

import { getProject } from "@/lib/db/projects";
import {
  deleteProjectGoal,
  getProjectGoal,
  updateProjectGoal,
} from "@/lib/db/project-goals";
import type { ProjectGoalStatus } from "@/lib/db/schema";
import { getServerViewer } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";

async function requireViewer() {
  const setupStatus = await getSetupStatus();
  const viewer = await getServerViewer(setupStatus);
  if (!viewer || setupStatus.storageMode !== "database") {
    return null;
  }
  return viewer;
}

export async function GET(
  _request: Request,
  context: {
    readonly params: Promise<{
      readonly id: string;
      readonly goalId: string;
    }>;
  },
) {
  const viewer = await requireViewer();
  if (!viewer) {
    return NextResponse.json(
      { error: "Sign in with durable storage configured." },
      { status: 401 },
    );
  }

  const { id: projectId, goalId } = await context.params;
  const owned = await getProject(viewer.id, projectId);
  if (!owned) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  const goal = await getProjectGoal(viewer.id, projectId, goalId);
  if (!goal) {
    return NextResponse.json({ error: "Goal not found." }, { status: 404 });
  }
  return NextResponse.json({ goal });
}

export async function PATCH(
  request: Request,
  context: {
    readonly params: Promise<{
      readonly id: string;
      readonly goalId: string;
    }>;
  },
) {
  const viewer = await requireViewer();
  if (!viewer) {
    return NextResponse.json(
      { error: "Sign in with durable storage configured." },
      { status: 401 },
    );
  }

  const { id: projectId, goalId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    readonly title?: string;
    readonly status?: ProjectGoalStatus;
    readonly targetDate?: string | null;
    readonly notes?: string | null;
  };

  try {
    const goal = await updateProjectGoal(viewer.id, projectId, goalId, body);
    if (!goal) {
      return NextResponse.json({ error: "Goal not found." }, { status: 404 });
    }
    return NextResponse.json({ goal });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to update goal.",
      },
      { status: 400 },
    );
  }
}

export async function DELETE(
  _request: Request,
  context: {
    readonly params: Promise<{
      readonly id: string;
      readonly goalId: string;
    }>;
  },
) {
  const viewer = await requireViewer();
  if (!viewer) {
    return NextResponse.json(
      { error: "Sign in with durable storage configured." },
      { status: 401 },
    );
  }

  const { id: projectId, goalId } = await context.params;
  const owned = await getProject(viewer.id, projectId);
  if (!owned) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  const ok = await deleteProjectGoal(viewer.id, projectId, goalId);
  if (!ok) {
    return NextResponse.json({ error: "Goal not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

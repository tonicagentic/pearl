import { NextResponse } from "next/server";

import { listGoalIssues } from "@/lib/db/issues";
import {
  deleteGoal,
  getGoal,
  updateGoal,
} from "@/lib/db/project-goals";
import { listGoalNotes } from "@/lib/db/project-notes";
import { listGoalChats } from "@/lib/db/projects";
import type { ProjectGoalStatus } from "@/lib/db/schema";
import { issueState, todayIso } from "@/lib/issues";
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

/** Goal detail: goal + tasks + chats + notes. */
export async function GET(
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
  const goal = await getGoal(viewer.id, id);
  if (!goal) {
    return NextResponse.json({ error: "Goal not found." }, { status: 404 });
  }

  const [tasks, chats, notes] = await Promise.all([
    listGoalIssues(viewer.id, id),
    listGoalChats(viewer.id, id),
    listGoalNotes(viewer.id, id),
  ]);

  return NextResponse.json({
    goal,
    tasks: tasks.map((row) => ({
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
    chats: chats.map((row) => ({
      id: row.id,
      title: row.title,
      updatedAt: row.updatedAt.toISOString(),
    })),
    notes,
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
    readonly title?: string;
    readonly status?: ProjectGoalStatus;
    readonly targetDate?: string | null;
    readonly notes?: string | null;
    readonly projectId?: string | null;
  };

  try {
    const goal = await updateGoal(viewer.id, id, body);
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
  const ok = await deleteGoal(viewer.id, id);
  if (!ok) {
    return NextResponse.json({ error: "Goal not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

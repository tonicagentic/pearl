import { NextResponse } from "next/server";

import { createGoal, listAllGoals } from "@/lib/db/project-goals";
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

export async function GET() {
  const viewer = await requireViewer();
  if (!viewer) {
    return NextResponse.json(
      { error: "Sign in with durable storage configured." },
      { status: 401 },
    );
  }

  const goals = await listAllGoals(viewer.id);
  return NextResponse.json({ goals });
}

export async function POST(request: Request) {
  const viewer = await requireViewer();
  if (!viewer) {
    return NextResponse.json(
      { error: "Sign in with durable storage configured." },
      { status: 401 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    readonly title?: string;
    readonly projectId?: string | null;
    readonly targetDate?: string | null;
    readonly notes?: string | null;
  };

  try {
    const goal = await createGoal(viewer.id, {
      title: typeof body.title === "string" ? body.title : "",
      projectId: body.projectId,
      targetDate: body.targetDate,
      notes: body.notes,
    });
    return NextResponse.json({ goal });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to create goal.",
      },
      { status: 400 },
    );
  }
}

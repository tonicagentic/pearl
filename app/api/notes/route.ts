import { NextResponse } from "next/server";

import { createNote, listAllNotes } from "@/lib/db/project-notes";
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

  const notes = await listAllNotes(viewer.id);
  return NextResponse.json({ notes });
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
    readonly markdown?: string;
    readonly projectId?: string | null;
    readonly goalId?: string | null;
  };

  try {
    const note = await createNote(viewer.id, {
      title: typeof body.title === "string" ? body.title : "",
      markdown: typeof body.markdown === "string" ? body.markdown : undefined,
      projectId: body.projectId,
      goalId: body.goalId,
    });
    return NextResponse.json({ note });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to create note.",
      },
      { status: 400 },
    );
  }
}

import { NextResponse } from "next/server";

import { getProject } from "@/lib/db/projects";
import {
  deleteProjectNote,
  getProjectNote,
  updateProjectNote,
} from "@/lib/db/project-notes";
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
      readonly noteId: string;
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

  const { id: projectId, noteId } = await context.params;
  const owned = await getProject(viewer.id, projectId);
  if (!owned) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  const note = await getProjectNote(viewer.id, projectId, noteId);
  if (!note) {
    return NextResponse.json({ error: "Note not found." }, { status: 404 });
  }
  return NextResponse.json({ note });
}

export async function PATCH(
  request: Request,
  context: {
    readonly params: Promise<{
      readonly id: string;
      readonly noteId: string;
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

  const { id: projectId, noteId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    readonly title?: string;
    readonly markdown?: string;
  };

  try {
    const note = await updateProjectNote(viewer.id, projectId, noteId, body);
    if (!note) {
      return NextResponse.json({ error: "Note not found." }, { status: 404 });
    }
    return NextResponse.json({ note });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to update note.",
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
      readonly noteId: string;
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

  const { id: projectId, noteId } = await context.params;
  const owned = await getProject(viewer.id, projectId);
  if (!owned) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  const ok = await deleteProjectNote(viewer.id, projectId, noteId);
  if (!ok) {
    return NextResponse.json({ error: "Note not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

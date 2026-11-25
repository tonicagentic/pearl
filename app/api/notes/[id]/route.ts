import { NextResponse } from "next/server";

import {
  deleteNote,
  getNote,
  updateNote,
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
  const note = await getNote(viewer.id, id);
  if (!note) {
    return NextResponse.json({ error: "Note not found." }, { status: 404 });
  }
  return NextResponse.json({ note });
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
    readonly markdown?: string;
    readonly projectId?: string | null;
  };

  try {
    const note = await updateNote(viewer.id, id, body);
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
  const ok = await deleteNote(viewer.id, id);
  if (!ok) {
    return NextResponse.json({ error: "Note not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

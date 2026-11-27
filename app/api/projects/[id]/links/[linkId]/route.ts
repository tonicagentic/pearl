import { NextResponse } from "next/server";

import { getProject } from "@/lib/db/projects";
import {
  deleteProjectLink,
  getProjectLink,
  updateProjectLink,
} from "@/lib/db/project-links";
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
      readonly linkId: string;
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

  const { id: projectId, linkId } = await context.params;
  const owned = await getProject(viewer.id, projectId);
  if (!owned) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  const link = await getProjectLink(viewer.id, projectId, linkId);
  if (!link) {
    return NextResponse.json({ error: "Link not found." }, { status: 404 });
  }
  return NextResponse.json({ link });
}

export async function PATCH(
  request: Request,
  context: {
    readonly params: Promise<{
      readonly id: string;
      readonly linkId: string;
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

  const { id: projectId, linkId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    readonly title?: string;
    readonly url?: string;
  };

  try {
    const link = await updateProjectLink(viewer.id, projectId, linkId, body);
    if (!link) {
      return NextResponse.json({ error: "Link not found." }, { status: 404 });
    }
    return NextResponse.json({ link });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to update link.",
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
      readonly linkId: string;
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

  const { id: projectId, linkId } = await context.params;
  const owned = await getProject(viewer.id, projectId);
  if (!owned) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  const ok = await deleteProjectLink(viewer.id, projectId, linkId);
  if (!ok) {
    return NextResponse.json({ error: "Link not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

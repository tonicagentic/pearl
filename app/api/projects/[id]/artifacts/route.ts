import { NextResponse } from "next/server";

import { getProject } from "@/lib/db/projects";
import {
  linkArtifactToProject,
  listProjectArtifacts,
} from "@/lib/db/project-artifacts";
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

/** List Library artifacts linked to a project. */
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

  const { id: projectId } = await context.params;
  const owned = await getProject(viewer.id, projectId);
  if (!owned) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  const artifacts = await listProjectArtifacts(viewer.id, projectId);
  return NextResponse.json({ artifacts });
}

/** Link a Library artifact. Body: `{ pathname }`. */
export async function POST(
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

  const { id: projectId } = await context.params;
  const owned = await getProject(viewer.id, projectId);
  if (!owned) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    readonly pathname?: string;
  };
  const pathname =
    typeof body.pathname === "string" ? body.pathname.trim() : "";
  if (!pathname) {
    return NextResponse.json(
      { error: "pathname is required." },
      { status: 400 },
    );
  }

  try {
    const artifact = await linkArtifactToProject(
      viewer.id,
      projectId,
      pathname,
    );
    if (!artifact) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }
    return NextResponse.json({ artifact });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to link the artifact.",
      },
      { status: 400 },
    );
  }
}

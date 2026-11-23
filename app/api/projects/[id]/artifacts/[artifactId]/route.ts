import { NextResponse } from "next/server";

import { getProject } from "@/lib/db/projects";
import { unlinkArtifactFromProject } from "@/lib/db/project-artifacts";
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

/** Unlink a Library artifact from a project. */
export async function DELETE(
  _request: Request,
  context: {
    readonly params: Promise<{
      readonly id: string;
      readonly artifactId: string;
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

  const { id: projectId, artifactId } = await context.params;
  const owned = await getProject(viewer.id, projectId);
  if (!owned) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  const ok = await unlinkArtifactFromProject(
    viewer.id,
    projectId,
    artifactId,
  );
  if (!ok) {
    return NextResponse.json(
      { error: "Linked artifact not found." },
      { status: 404 },
    );
  }
  return NextResponse.json({ ok: true });
}

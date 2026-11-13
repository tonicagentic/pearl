import { NextResponse } from "next/server";

import { getProject } from "@/lib/db/projects";
import { unlinkPinFromProject } from "@/lib/db/workbench-pins";
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

/** Unlink a pin from a project (does not delete the workbench pin). */
export async function DELETE(
  _request: Request,
  context: {
    readonly params: Promise<{ readonly id: string; readonly pinId: string }>;
  },
) {
  const viewer = await requireViewer();
  if (!viewer) {
    return NextResponse.json(
      { error: "Sign in with durable storage configured." },
      { status: 401 },
    );
  }

  const { id: projectId, pinId } = await context.params;
  const owned = await getProject(viewer.id, projectId);
  if (!owned) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  const unlinked = await unlinkPinFromProject(viewer.id, projectId, pinId);
  if (!unlinked) {
    return NextResponse.json(
      { error: "Pin not linked to this project." },
      { status: 404 },
    );
  }
  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";

import { deleteProjectLabel } from "@/lib/db/project-labels";
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
  const ok = await deleteProjectLabel(viewer.id, id);
  if (!ok) {
    return NextResponse.json({ error: "Label not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

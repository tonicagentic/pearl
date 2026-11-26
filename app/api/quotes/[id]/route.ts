import { NextResponse } from "next/server";

import { deleteLibraryQuote } from "@/lib/db/library-quotes";
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
  if (!id?.trim()) {
    return NextResponse.json({ error: "Missing quote id." }, { status: 400 });
  }

  const deleted = await deleteLibraryQuote(viewer.id, id.trim());
  if (!deleted) {
    return NextResponse.json({ error: "Quote not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

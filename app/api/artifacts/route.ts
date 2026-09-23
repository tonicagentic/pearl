import { NextResponse } from "next/server";
import { del, list } from "@vercel/blob";
import { artifactsPrefix } from "@/agent/lib/artifacts";
import { getServerViewer } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";

// Stored artifacts: the durable, principal-scoped copies the agent syncs with
// save_artifact and restores at session start (docs:
// artifact-persistence-plan.md). Blob calls stay server-side behind the app's
// auth; the browser never receives Blob credentials.

export async function GET() {
  const setupStatus = await getSetupStatus();

  if (!setupStatus.appReady || setupStatus.storageMode !== "database") {
    return NextResponse.json(
      { error: "Stored artifacts require database-backed storage." },
      { status: 503 },
    );
  }

  const viewer = await getServerViewer(setupStatus);

  if (!viewer) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const prefix = artifactsPrefix({
    principalId: viewer.id,
    principalType: "user",
  });

  if (!prefix) {
    return NextResponse.json(
      { error: "No artifact scope for this principal." },
      { status: 403 },
    );
  }

  try {
    const { blobs } = await list({ prefix });

    return NextResponse.json({
      artifacts: blobs.map((blob) => ({
        pathname: blob.pathname,
        basename: blob.pathname.slice(prefix.length),
        size: blob.size,
        uploadedAt: blob.uploadedAt.toISOString(),
      })),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to list artifacts",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  const setupStatus = await getSetupStatus();

  if (!setupStatus.appReady || setupStatus.storageMode !== "database") {
    return NextResponse.json(
      { error: "Stored artifacts require database-backed storage." },
      { status: 503 },
    );
  }

  const viewer = await getServerViewer(setupStatus);

  if (!viewer) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const prefix = artifactsPrefix({
    principalId: viewer.id,
    principalType: "user",
  });

  let pathname: string | undefined;

  try {
    const body = (await request.json()) as { readonly pathname?: string };
    pathname = body.pathname;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!pathname || !prefix || !pathname.startsWith(prefix)) {
    return NextResponse.json(
      { error: "pathname is required and must be one of your artifacts." },
      { status: 400 },
    );
  }

  try {
    await del(pathname);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to delete artifact",
      },
      { status: 500 },
    );
  }
}

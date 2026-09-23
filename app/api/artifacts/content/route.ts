import { NextResponse } from "next/server";
import { get } from "@vercel/blob";
import { artifactsPrefix } from "@/agent/lib/artifacts";
import { getServerViewer } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";

// Artifact content: served server-side so the browser never talks to Blob
// directly (also keeps the door open for private-access stores later).
// `?download=1` adds a Content-Disposition attachment header.

export async function GET(request: Request) {
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

  const { searchParams } = new URL(request.url);
  const pathname = searchParams.get("pathname");

  if (!pathname || !prefix || !pathname.startsWith(prefix)) {
    return NextResponse.json(
      { error: "pathname is required and must be one of your artifacts." },
      { status: 400 },
    );
  }

  try {
    const result = await get(pathname, { access: "public" });

    if (!result || result.statusCode !== 200) {
      return NextResponse.json(
        { error: "Artifact not readable from storage." },
        { status: 404 },
      );
    }

    const response = await fetch(result.blob.url);

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to read: ${response.status} ${response.statusText}` },
        { status: 502 },
      );
    }

    const contentType =
      response.headers.get("content-type") ?? "application/octet-stream";
    const basename = pathname.slice(prefix.length);
    const headers = new Headers({
      "content-type": contentType,
    });

    if (searchParams.get("download")) {
      headers.set(
        "content-disposition",
        `attachment; filename="${basename.replace(/[^\w.-]/g, "_")}"`,
      );
    }

    return new Response(response.body, { headers });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to read artifact",
      },
      { status: 500 },
    );
  }
}

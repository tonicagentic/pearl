import { NextResponse } from "next/server";

import { getServerViewer } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";
import { fetchEasWatch } from "@/lib/watch/eas-status";

/**
 * Live EAS build status for chat watch cards.
 * Session-auth only; tokens stay server-side.
 */
export async function GET(request: Request) {
  const setupStatus = await getSetupStatus();
  const viewer = await getServerViewer(setupStatus, request.headers);
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const buildId = searchParams.get("buildId");
  const includeLogs = searchParams.get("logs") === "1";

  if (!buildId?.trim()) {
    return NextResponse.json(
      { error: "buildId is required." },
      { status: 400 },
    );
  }

  try {
    const snapshot = await fetchEasWatch({
      userId: viewer.id,
      buildId,
      includeLogs,
    });
    return NextResponse.json(snapshot);
  } catch (cause) {
    return NextResponse.json(
      {
        error:
          cause instanceof Error ? cause.message : "Failed to load EAS build.",
      },
      { status: 502 },
    );
  }
}

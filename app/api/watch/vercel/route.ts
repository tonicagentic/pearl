import { NextResponse } from "next/server";

import { getServerViewer } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";
import { fetchVercelWatch } from "@/lib/watch/vercel-status";

/**
 * Live Vercel deployment status for chat watch cards.
 * Session-auth only; tokens stay server-side.
 */
export async function GET(request: Request) {
  const setupStatus = await getSetupStatus();
  const viewer = await getServerViewer(setupStatus, request.headers);
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const deploymentId = searchParams.get("deploymentId");
  const url = searchParams.get("url");
  const projectId = searchParams.get("projectId");
  const teamId = searchParams.get("teamId");
  const target = searchParams.get("target");
  const includeLogs = searchParams.get("logs") === "1";

  if (!deploymentId?.trim() && !url?.trim()) {
    return NextResponse.json(
      { error: "deploymentId or url is required." },
      { status: 400 },
    );
  }

  try {
    const snapshot = await fetchVercelWatch({
      userId: viewer.id,
      deploymentId,
      url,
      projectId,
      teamId,
      target,
      includeLogs,
    });
    return NextResponse.json(snapshot);
  } catch (cause) {
    return NextResponse.json(
      {
        error:
          cause instanceof Error ? cause.message : "Failed to load deployment.",
      },
      { status: 502 },
    );
  }
}

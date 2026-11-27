import { NextResponse } from "next/server";

import {
  createProjectLabel,
  listProjectLabels,
} from "@/lib/db/project-labels";
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

/** Per-user project label catalog. */
export async function GET() {
  const viewer = await requireViewer();
  if (!viewer) {
    return NextResponse.json(
      { error: "Sign in with durable storage configured." },
      { status: 401 },
    );
  }

  const labels = await listProjectLabels(viewer.id);
  return NextResponse.json({ labels });
}

export async function POST(request: Request) {
  const viewer = await requireViewer();
  if (!viewer) {
    return NextResponse.json(
      { error: "Sign in with durable storage configured." },
      { status: 401 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    readonly name?: string;
    readonly color?: string;
  };

  try {
    const label = await createProjectLabel(viewer.id, {
      name: typeof body.name === "string" ? body.name : "",
      color: body.color,
    });
    return NextResponse.json({ label });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to create label.",
      },
      { status: 400 },
    );
  }
}

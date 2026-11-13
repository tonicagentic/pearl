import { NextResponse } from "next/server";

import {
  createWorkbenchPin,
  listWorkbenchPins,
} from "@/lib/db/workbench-pins";
import { getServerViewer } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";
import { PEARL_SUGGESTED_PIN } from "@/lib/workbench/types";

/** List / create workbench pins for the signed-in user. */
export async function GET(request: Request) {
  const setupStatus = await getSetupStatus();
  const viewer = await getServerViewer(setupStatus, request.headers);

  if (!viewer || setupStatus.storageMode !== "database") {
    return NextResponse.json(
      { error: "Sign in with durable storage configured." },
      { status: 401 },
    );
  }

  const pins = await listWorkbenchPins(viewer.id);
  return NextResponse.json({
    pins,
    suggested: pins.length === 0 ? PEARL_SUGGESTED_PIN : null,
  });
}

export async function POST(request: Request) {
  const setupStatus = await getSetupStatus();
  const viewer = await getServerViewer(setupStatus, request.headers);

  if (!viewer || setupStatus.storageMode !== "database") {
    return NextResponse.json(
      { error: "Sign in with durable storage configured." },
      { status: 401 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    readonly owner?: string;
    readonly name?: string;
    readonly fullName?: string;
    readonly vercelProjectId?: string | null;
    readonly vercelTeamId?: string | null;
    readonly expoProjectId?: string | null;
    readonly expoUpdateChannel?: string | null;
  };

  try {
    const pin = await createWorkbenchPin(viewer.id, body);
    return NextResponse.json({ pin });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to create pin.",
      },
      { status: 400 },
    );
  }
}

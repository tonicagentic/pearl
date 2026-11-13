import { NextResponse } from "next/server";

import {
  deleteWorkbenchPin,
  getWorkbenchPin,
  updateWorkbenchPin,
} from "@/lib/db/workbench-pins";
import { getServerViewer } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";

type Ctx = { readonly params: Promise<{ readonly id: string }> };

export async function GET(request: Request, { params }: Ctx) {
  const setupStatus = await getSetupStatus();
  const viewer = await getServerViewer(setupStatus, request.headers);
  if (!viewer || setupStatus.storageMode !== "database") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const pin = await getWorkbenchPin(viewer.id, id);
  if (!pin) {
    return NextResponse.json({ error: "Pin not found." }, { status: 404 });
  }
  return NextResponse.json({ pin });
}

export async function PATCH(request: Request, { params }: Ctx) {
  const setupStatus = await getSetupStatus();
  const viewer = await getServerViewer(setupStatus, request.headers);
  if (!viewer || setupStatus.storageMode !== "database") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    readonly vercelProjectId?: string | null;
    readonly vercelTeamId?: string | null;
    readonly expoProjectId?: string | null;
    readonly expoUpdateChannel?: string | null;
  };
  const pin = await updateWorkbenchPin(viewer.id, id, body);
  if (!pin) {
    return NextResponse.json({ error: "Pin not found." }, { status: 404 });
  }
  return NextResponse.json({ pin });
}

export async function DELETE(request: Request, { params }: Ctx) {
  const setupStatus = await getSetupStatus();
  const viewer = await getServerViewer(setupStatus, request.headers);
  if (!viewer || setupStatus.storageMode !== "database") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const ok = await deleteWorkbenchPin(viewer.id, id);
  if (!ok) {
    return NextResponse.json({ error: "Pin not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

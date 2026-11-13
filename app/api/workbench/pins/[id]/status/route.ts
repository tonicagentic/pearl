import { NextResponse } from "next/server";

import { getWorkbenchPin } from "@/lib/db/workbench-pins";
import { getServerViewer } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";
import { loadPinStatus } from "@/lib/workbench/pin-status";

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
  const status = await loadPinStatus(viewer.id, pin);
  return NextResponse.json({ pin, status });
}

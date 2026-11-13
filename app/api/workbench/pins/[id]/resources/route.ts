import { NextResponse } from "next/server";

import { getWorkbenchPin } from "@/lib/db/workbench-pins";
import { getServerViewer } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";
import { payloadLeaksSecret } from "@/lib/workbench/approvals";
import { loadPinResources } from "@/lib/workbench/pin-status";

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
  const resources = await loadPinResources(viewer.id, pin);
  if (payloadLeaksSecret(resources)) {
    return NextResponse.json(
      { error: "Refusing to return a payload that looks secret-bearing." },
      { status: 500 },
    );
  }
  return NextResponse.json({ pin, resources });
}

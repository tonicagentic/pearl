import { NextResponse } from "next/server";

import { getWorkbenchPin } from "@/lib/db/workbench-pins";
import { getServerViewer } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";
import { loadPinUsage } from "@/lib/workbench/pin-status";

type Ctx = { readonly params: Promise<{ readonly id: string }> };

/**
 * Vercel team usage for the pin. Distinct from Pearl Settings → Billing
 * (`/api/billing/status`).
 */
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
  const usage = await loadPinUsage(viewer.id, pin);
  return NextResponse.json({
    kind: "vercel-usage",
    pinId: pin.id,
    usage,
    pearlBillingPath: "/api/billing/status",
  });
}

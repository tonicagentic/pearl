import { NextResponse } from "next/server";

import { getWorkbenchPin } from "@/lib/db/workbench-pins";
import { getServerViewer } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";
import { payloadLeaksSecret } from "@/lib/workbench/approvals";
import { sanitizeDatabasePayload } from "@/lib/workbench/database";
import {
  getPinDatabaseStatus,
  queryPinDatabase,
} from "@/lib/workbench/vercel-database";

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
  const result = await getPinDatabaseStatus(viewer.id, pin);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  const status = sanitizeDatabasePayload({ ...result.status });
  if (payloadLeaksSecret(status)) {
    return NextResponse.json(
      { error: "Refusing to return a secret-bearing database payload." },
      { status: 500 },
    );
  }
  return NextResponse.json({ pinId: pin.id, status });
}

export async function POST(request: Request, { params }: Ctx) {
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
  const body = (await request.json().catch(() => ({}))) as {
    readonly sql?: string;
  };
  const result = await queryPinDatabase(viewer.id, pin, body.sql ?? "");
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  if (payloadLeaksSecret(result)) {
    return NextResponse.json(
      { error: "Refusing to return a secret-bearing query result." },
      { status: 500 },
    );
  }
  return NextResponse.json({
    pinId: pin.id,
    fields: result.fields,
    rows: result.rows,
    truncated: result.truncated,
  });
}

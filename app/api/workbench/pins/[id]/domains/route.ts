import { NextResponse } from "next/server";

import { getWorkbenchPin } from "@/lib/db/workbench-pins";
import { getVercelUserToken } from "@/lib/connections/tokens";
import { getServerViewer } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";
import { buildApprovalCard } from "@/lib/workbench/approvals";
import {
  addProjectDomain,
  createVercelFetch,
} from "@/lib/workbench/vercel-client";

type Ctx = { readonly params: Promise<{ readonly id: string }> };

export async function POST(request: Request, { params }: Ctx) {
  const setupStatus = await getSetupStatus();
  const viewer = await getServerViewer(setupStatus, request.headers);
  if (!viewer || setupStatus.storageMode !== "database") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const pin = await getWorkbenchPin(viewer.id, id);
  if (!pin?.vercelProjectId) {
    return NextResponse.json(
      { error: "Pin needs a Vercel project id." },
      { status: 400 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    readonly name?: string;
    readonly approved?: boolean;
  };
  const name = body.name?.trim() ?? "";
  if (!name) {
    return NextResponse.json({ error: "name is required." }, { status: 400 });
  }
  if (!body.approved) {
    const card = buildApprovalCard({
      action: "domain_add",
      owner: pin.owner,
      repo: pin.name,
      target: name,
      detail: name,
    });
    return NextResponse.json(
      { error: "Approval required.", card },
      { status: 403 },
    );
  }

  try {
    const token = await getVercelUserToken(viewer.id);
    const added = await addProjectDomain(createVercelFetch(token), {
      projectId: pin.vercelProjectId,
      teamId: pin.vercelTeamId,
      name,
    });
    return NextResponse.json({ ok: true, name: added.name });
  } catch (cause) {
    return NextResponse.json(
      {
        error: cause instanceof Error ? cause.message : "Domain add failed.",
      },
      { status: 502 },
    );
  }
}

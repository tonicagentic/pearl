import { NextResponse } from "next/server";

import { getWorkbenchPin } from "@/lib/db/workbench-pins";
import { getVercelUserToken } from "@/lib/connections/tokens";
import { getServerViewer } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";
import { buildApprovalCard } from "@/lib/workbench/approvals";
import {
  createVercelFetch,
  writeProjectEnv,
} from "@/lib/workbench/vercel-client";

type Ctx = { readonly params: Promise<{ readonly id: string }> };

/**
 * Set an env var on the pin's Vercel project.
 * The value is accepted once in the body and never echoed back.
 * Callers must have already shown an approval card on the client / agent.
 */
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
    readonly key?: string;
    readonly value?: string;
    readonly target?: readonly ("production" | "preview" | "development")[];
    readonly approved?: boolean;
  };

  const key = body.key?.trim() ?? "";
  const value = body.value ?? "";
  const target = body.target?.length
    ? body.target
    : (["production"] as const);

  if (!key || !value) {
    return NextResponse.json(
      { error: "key and value are required." },
      { status: 400 },
    );
  }
  if (!body.approved) {
    const card = buildApprovalCard({
      action: "env_write",
      owner: pin.owner,
      repo: pin.name,
      target: target.join(","),
      detail: key,
    });
    return NextResponse.json(
      { error: "Approval required.", card },
      { status: 403 },
    );
  }

  try {
    const token = await getVercelUserToken(viewer.id);
    const written = await writeProjectEnv(createVercelFetch(token), {
      projectId: pin.vercelProjectId,
      teamId: pin.vercelTeamId,
      key,
      value,
      target: [...target],
    });
    // Never echo the value.
    return NextResponse.json({
      ok: true,
      id: written.id,
      key: written.key,
      target,
    });
  } catch (cause) {
    return NextResponse.json(
      {
        error: cause instanceof Error ? cause.message : "Env write failed.",
      },
      { status: 502 },
    );
  }
}

import { NextResponse } from "next/server";

import { upsertCustomAgentRoutine } from "@/lib/custom-agents/config";
import { CustomAgentError } from "@/lib/custom-agents/store";
import { ensureUserForPrincipal } from "@/lib/db/issues";
import { getServerViewer } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";

export async function POST(
  request: Request,
  context: { readonly params: Promise<{ readonly id: string }> },
) {
  const setupStatus = await getSetupStatus();
  const viewer = await getServerViewer(setupStatus, request.headers);
  if (!viewer || setupStatus.storageMode !== "database") {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  await ensureUserForPrincipal({
    principalId: viewer.id,
    attributes: { name: viewer.name, email: viewer.email },
  });
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    readonly id?: string;
    readonly name?: string;
    readonly cron?: string;
    readonly timezone?: string;
    readonly prompt?: string;
    readonly enabled?: boolean;
  };
  try {
    const routine = await upsertCustomAgentRoutine(viewer.id, id, {
      id: body.id,
      name: body.name ?? "",
      cron: body.cron ?? "",
      timezone: body.timezone,
      prompt: body.prompt ?? "",
      enabled: body.enabled,
    });
    return NextResponse.json({ routine });
  } catch (error) {
    const message =
      error instanceof CustomAgentError
        ? error.message
        : "Failed to save routine.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

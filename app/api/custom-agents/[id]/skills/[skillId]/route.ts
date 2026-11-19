import { NextResponse } from "next/server";

import { deleteCustomAgentSkill } from "@/lib/custom-agents/config";
import { ensureUserForPrincipal } from "@/lib/db/issues";
import { getServerViewer } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";

export async function DELETE(
  request: Request,
  context: {
    readonly params: Promise<{ readonly id: string; readonly skillId: string }>;
  },
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
  const { id, skillId } = await context.params;
  const ok = await deleteCustomAgentSkill(viewer.id, id, skillId);
  if (!ok) {
    return NextResponse.json({ error: "Unknown skill." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

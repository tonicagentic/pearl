import { NextResponse } from "next/server";

import { listAgentTemplates } from "@/lib/custom-agents/templates";
import { getServerViewer } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";

/** Public directory list; added state is filled when signed in. */
export async function GET(request: Request) {
  const setupStatus = await getSetupStatus();
  const viewer = await getServerViewer(setupStatus, request.headers);
  const templates = await listAgentTemplates(
    setupStatus.storageMode === "database" && viewer ? viewer.id : null,
  );
  return NextResponse.json({ templates });
}

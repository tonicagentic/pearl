import { NextResponse } from "next/server";

import { getAgentTemplate } from "@/lib/custom-agents/templates";
import { getServerViewer } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";

export async function GET(
  request: Request,
  context: { readonly params: Promise<{ readonly slug: string }> },
) {
  const { slug } = await context.params;
  const setupStatus = await getSetupStatus();
  const viewer = await getServerViewer(setupStatus, request.headers);
  const template = await getAgentTemplate(
    slug,
    setupStatus.storageMode === "database" && viewer ? viewer.id : null,
  );
  if (!template) {
    return NextResponse.json({ error: "Unknown template." }, { status: 404 });
  }
  return NextResponse.json({ template });
}

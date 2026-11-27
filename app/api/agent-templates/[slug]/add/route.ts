import { NextResponse } from "next/server";

import { CustomAgentError } from "@/lib/custom-agents/store";
import { addAgentFromTemplate } from "@/lib/custom-agents/templates";
import { ensureUserForPrincipal } from "@/lib/db/issues";
import { getServerViewer } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";

export async function POST(
  request: Request,
  context: { readonly params: Promise<{ readonly slug: string }> },
) {
  const { slug } = await context.params;
  const setupStatus = await getSetupStatus();
  const viewer = await getServerViewer(setupStatus, request.headers);

  if (!viewer || setupStatus.storageMode !== "database") {
    return NextResponse.json(
      { error: "Sign in with durable storage configured." },
      { status: 401 },
    );
  }

  await ensureUserForPrincipal({
    principalId: viewer.id,
    attributes: { name: viewer.name, email: viewer.email },
  });

  const body = (await request.json().catch(() => ({}))) as {
    readonly projectId?: string;
  };
  const projectId = body.projectId?.trim() ?? "";
  if (!projectId) {
    return NextResponse.json(
      { error: "Choose a project to add this agent to." },
      { status: 400 },
    );
  }

  try {
    const agent = await addAgentFromTemplate(viewer.id, slug, projectId);
    return NextResponse.json({ agent });
  } catch (error) {
    const message =
      error instanceof CustomAgentError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Failed to add agent.";
    const conflict = /unique|duplicate|already/i.test(message);
    return NextResponse.json(
      { error: message },
      { status: conflict ? 409 : 400 },
    );
  }
}

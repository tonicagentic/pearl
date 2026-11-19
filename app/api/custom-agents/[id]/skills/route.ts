import { NextResponse } from "next/server";

import { upsertCustomAgentSkill } from "@/lib/custom-agents/config";
import { CustomAgentError } from "@/lib/custom-agents/store";
import { ensureUserForPrincipal } from "@/lib/db/issues";
import { getServerViewer } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";

async function requireViewer(request: Request) {
  const setupStatus = await getSetupStatus();
  const viewer = await getServerViewer(setupStatus, request.headers);
  if (!viewer || setupStatus.storageMode !== "database") return null;
  await ensureUserForPrincipal({
    principalId: viewer.id,
    attributes: { name: viewer.name, email: viewer.email },
  });
  return viewer;
}

export async function POST(
  request: Request,
  context: { readonly params: Promise<{ readonly id: string }> },
) {
  const viewer = await requireViewer(request);
  if (!viewer) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    readonly id?: string;
    readonly slug?: string;
    readonly title?: string;
    readonly description?: string;
    readonly markdown?: string;
    readonly enabled?: boolean;
  };
  try {
    const skill = await upsertCustomAgentSkill(viewer.id, id, {
      id: body.id,
      slug: body.slug ?? "",
      title: body.title ?? "",
      description: body.description ?? "",
      markdown: body.markdown ?? "",
      enabled: body.enabled,
    });
    return NextResponse.json({ skill });
  } catch (error) {
    const message =
      error instanceof CustomAgentError
        ? error.message
        : "Failed to save skill.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

import { NextResponse } from "next/server";

import { addCustomAgentMemory } from "@/lib/custom-agents/config";
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
    readonly text?: string;
  };
  try {
    const memory = await addCustomAgentMemory(
      viewer.id,
      id,
      body.text ?? "",
    );
    return NextResponse.json({ memory });
  } catch (error) {
    const message =
      error instanceof CustomAgentError
        ? error.message
        : "Failed to add memory.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

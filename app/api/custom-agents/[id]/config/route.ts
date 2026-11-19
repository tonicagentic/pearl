import { NextResponse } from "next/server";

import {
  getCustomAgentConfig,
  setCustomAgentIntegrations,
} from "@/lib/custom-agents/config";
import { CustomAgentError } from "@/lib/custom-agents/store";
import { ensureUserForPrincipal } from "@/lib/db/issues";
import { getServerViewer } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";

async function requireViewer(request: Request) {
  const setupStatus = await getSetupStatus();
  const viewer = await getServerViewer(setupStatus, request.headers);
  if (!viewer || setupStatus.storageMode !== "database") {
    return null;
  }
  await ensureUserForPrincipal({
    principalId: viewer.id,
    attributes: { name: viewer.name, email: viewer.email },
  });
  return viewer;
}

export async function GET(
  request: Request,
  context: { readonly params: Promise<{ readonly id: string }> },
) {
  const viewer = await requireViewer(request);
  if (!viewer) {
    return NextResponse.json(
      { error: "Sign in with durable storage configured." },
      { status: 401 },
    );
  }
  const { id } = await context.params;
  const config = await getCustomAgentConfig(viewer.id, id);
  if (!config) {
    return NextResponse.json({ error: "Unknown agent." }, { status: 404 });
  }
  return NextResponse.json({ config });
}

/** Replace the integrations allowlist. */
export async function PUT(
  request: Request,
  context: { readonly params: Promise<{ readonly id: string }> },
) {
  const viewer = await requireViewer(request);
  if (!viewer) {
    return NextResponse.json(
      { error: "Sign in with durable storage configured." },
      { status: 401 },
    );
  }
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    readonly connectionIds?: readonly string[];
  };
  try {
    const integrations = await setCustomAgentIntegrations(
      viewer.id,
      id,
      body.connectionIds ?? [],
    );
    return NextResponse.json({ integrations });
  } catch (error) {
    const message =
      error instanceof CustomAgentError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Failed to update integrations.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

import { NextResponse } from "next/server";

import {
  CustomAgentError,
  createCustomAgent,
  listCustomAgents,
} from "@/lib/custom-agents/store";
import { ensureUserForPrincipal } from "@/lib/db/issues";
import { getServerViewer } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";

/** Authenticated custom-agent list/create for web + mobile. */
export async function GET(request: Request) {
  const setupStatus = await getSetupStatus();
  const viewer = await getServerViewer(setupStatus, request.headers);

  if (!viewer || setupStatus.storageMode !== "database") {
    return NextResponse.json(
      { error: "Sign in with durable storage configured." },
      { status: 401 },
    );
  }

  const agents = await listCustomAgents(viewer.id);
  return NextResponse.json({ agents });
}

export async function POST(request: Request) {
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
    readonly name?: string;
    readonly instructions?: string;
    readonly accent?: string;
    readonly markShape?: string;
    readonly markTalk?: string;
  };

  try {
    const agent = await createCustomAgent(viewer.id, {
      name: body.name ?? "",
      instructions: body.instructions,
      accent: body.accent,
      markShape: body.markShape,
      markTalk: body.markTalk,
    });
    return NextResponse.json({ agent });
  } catch (error) {
    const message =
      error instanceof CustomAgentError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Failed to create agent.";
    // Unique name collision surfaces as a DB error; soften it.
    const conflict =
      typeof message === "string" &&
      /unique|duplicate/i.test(message);
    return NextResponse.json(
      {
        error: conflict
          ? "You already have an agent with that name."
          : message,
      },
      { status: conflict ? 409 : 400 },
    );
  }
}

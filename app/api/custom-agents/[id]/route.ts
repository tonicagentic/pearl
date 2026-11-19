import { NextResponse } from "next/server";

import {
  CustomAgentError,
  deleteCustomAgent,
  getCustomAgent,
  updateCustomAgent,
} from "@/lib/custom-agents/store";
import { getServerViewer } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";

async function requireViewer(request: Request) {
  const setupStatus = await getSetupStatus();
  const viewer = await getServerViewer(setupStatus, request.headers);
  if (!viewer || setupStatus.storageMode !== "database") {
    return null;
  }
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
  const agent = await getCustomAgent(viewer.id, id);
  if (!agent) {
    return NextResponse.json({ error: "Agent not found." }, { status: 404 });
  }
  return NextResponse.json({ agent });
}

export async function PATCH(
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
    readonly name?: string;
    readonly instructions?: string;
    readonly accent?: string;
  };

  try {
    const agent = await updateCustomAgent(viewer.id, id, body);
    if (!agent) {
      return NextResponse.json({ error: "Agent not found." }, { status: 404 });
    }
    return NextResponse.json({ agent });
  } catch (error) {
    const message =
      error instanceof CustomAgentError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Failed to update agent.";
    const conflict =
      typeof message === "string" && /unique|duplicate/i.test(message);
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

export async function DELETE(
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
  const deleted = await deleteCustomAgent(viewer.id, id);
  if (!deleted) {
    return NextResponse.json({ error: "Agent not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

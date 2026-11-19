import { NextResponse } from "next/server";

import { upsertClientAttention } from "@/lib/db/attention";
import { ensureUserForPrincipal } from "@/lib/db/issues";
import { getServerViewer } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";

/**
 * Heartbeat / visibility for push gating.
 * POST body: { surface, clientKey, state, chatId?, sessionId? }.
 */

async function requireViewer() {
  const setupStatus = await getSetupStatus();
  const viewer = await getServerViewer(setupStatus);

  if (!viewer || setupStatus.storageMode !== "database") {
    return null;
  }

  await ensureUserForPrincipal({
    principalId: viewer.id,
    attributes: { name: viewer.name, email: viewer.email },
  });

  return viewer;
}

export async function POST(request: Request) {
  const viewer = await requireViewer();

  if (!viewer) {
    return NextResponse.json(
      { error: "Sign in with durable storage configured." },
      { status: 401 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const surface = body.surface;
  const clientKey =
    typeof body.clientKey === "string" ? body.clientKey.trim() : "";
  const state = body.state;
  const chatId =
    typeof body.chatId === "string"
      ? body.chatId.trim()
      : body.chatId === null
        ? null
        : undefined;
  const sessionId =
    typeof body.sessionId === "string"
      ? body.sessionId.trim()
      : body.sessionId === null
        ? null
        : undefined;

  if (surface !== "mobile" && surface !== "web") {
    return NextResponse.json(
      { error: "surface must be mobile or web." },
      { status: 400 },
    );
  }
  if (!clientKey) {
    return NextResponse.json(
      { error: "clientKey is required." },
      { status: 400 },
    );
  }
  if (state !== "active" && state !== "background") {
    return NextResponse.json(
      { error: "state must be active or background." },
      { status: 400 },
    );
  }

  try {
    await upsertClientAttention({
      userId: viewer.id,
      surface,
      clientKey,
      state,
      chatId,
      sessionId,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed." },
      { status: 400 },
    );
  }
}

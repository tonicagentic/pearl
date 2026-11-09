import { NextResponse } from "next/server";

import {
  deleteDevicePushToken,
  upsertDevicePushToken,
} from "@/lib/db/push";
import { ensureUserForPrincipal } from "@/lib/db/issues";
import { getServerViewer } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";

/**
 * Register or remove Expo push tokens for the signed-in mobile user.
 * POST body: { token, platform }. DELETE body: { token }.
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

  const token = typeof body.token === "string" ? body.token.trim() : "";
  const platform =
    typeof body.platform === "string" ? body.platform.trim() : "unknown";

  if (!token) {
    return NextResponse.json({ error: "token is required." }, { status: 400 });
  }

  try {
    await upsertDevicePushToken({
      userId: viewer.id,
      token,
      platform,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed." },
      { status: 400 },
    );
  }
}

export async function DELETE(request: Request) {
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

  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (!token) {
    return NextResponse.json({ error: "token is required." }, { status: 400 });
  }

  await deleteDevicePushToken({ userId: viewer.id, token });
  return NextResponse.json({ ok: true });
}

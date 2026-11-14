import { NextResponse } from "next/server";

import { SandboxSettingsError, type SandboxSettingsPatch } from "@/lib/sandbox/settings";
import {
  getSandboxSettings,
  updateSandboxSettings,
} from "@/lib/sandbox/store";
import { getServerViewer } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";

/**
 * Per-account Computer Use sandbox settings. GET returns the current values.
 * POST replaces any fields included in the body. Changes apply the next time
 * a browser or coder sandbox starts.
 */

async function requireViewer(request: Request) {
  const setupStatus = await getSetupStatus();
  const viewer = await getServerViewer(setupStatus, request.headers);
  if (!viewer || setupStatus.storageMode !== "database") return null;
  return viewer;
}

export async function GET(request: Request) {
  const viewer = await requireViewer(request);
  if (!viewer) {
    return NextResponse.json(
      { error: "Sign in with durable storage configured." },
      { status: 401 },
    );
  }
  return NextResponse.json(await getSandboxSettings(viewer.id));
}

export async function POST(request: Request) {
  const viewer = await requireViewer(request);
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

  try {
    const patch: SandboxSettingsPatch = {
      ...("browserTimeoutMinutes" in body
        ? { browserTimeoutMinutes: readNumber(body.browserTimeoutMinutes) }
        : {}),
      ...("browserVcpus" in body
        ? { browserVcpus: readNumber(body.browserVcpus) }
        : {}),
      ...("coderTimeoutMinutes" in body
        ? { coderTimeoutMinutes: readNumber(body.coderTimeoutMinutes) }
        : {}),
      ...("coderVcpus" in body
        ? { coderVcpus: readNumber(body.coderVcpus) }
        : {}),
    };
    return NextResponse.json(await updateSandboxSettings(viewer.id, patch));
  } catch (error) {
    const message =
      error instanceof SandboxSettingsError
        ? error.message
        : "Could not save sandbox settings.";
    const status = error instanceof SandboxSettingsError ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

function readNumber(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new SandboxSettingsError("Sandbox settings must be numbers.");
  }
  return value;
}

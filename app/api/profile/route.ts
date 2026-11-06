import { NextResponse } from "next/server";

import { ensureUserForPrincipal } from "@/lib/db/issues";
import { getUserProfile, upsertUserProfile } from "@/lib/db/profile";
import { toProfileDto } from "@/lib/profile/serialize";
import type { ProfileFormInput } from "@/lib/profile/validation";
import { getServerViewer } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";

/**
 * Identity profile for the mobile app. GET returns the signed-in user's
 * structured profile (or null). POST upserts the same fields Settings edits
 * on the web.
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

function stringOrNull(value: unknown): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  return typeof value === "string" ? value : undefined;
}

function bodyToInput(body: Record<string, unknown>): ProfileFormInput {
  return {
    displayName: stringOrNull(body.displayName),
    birthdate: stringOrNull(body.birthdate),
    nationality: stringOrNull(body.nationality),
    height: stringOrNull(body.height),
    eyeColor: stringOrNull(body.eyeColor),
    hairColor: stringOrNull(body.hairColor),
    skinTone: stringOrNull(body.skinTone),
    weight: stringOrNull(body.weight),
    build: stringOrNull(body.build),
    gender: stringOrNull(body.gender),
    measurements: stringOrNull(body.measurements),
    healthNotes: stringOrNull(body.healthNotes),
    primaryResidence: stringOrNull(body.primaryResidence),
    additionalHomes: stringOrNull(body.additionalHomes),
  };
}

export async function GET() {
  const viewer = await requireViewer();

  if (!viewer) {
    return NextResponse.json(
      { error: "Sign in with durable storage configured." },
      { status: 401 },
    );
  }

  const profile = toProfileDto(await getUserProfile(viewer.id));

  return NextResponse.json({
    viewer: { id: viewer.id, name: viewer.name, email: viewer.email },
    profile,
  });
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

  try {
    const row = await upsertUserProfile(viewer.id, bodyToInput(body));
    return NextResponse.json({ profile: toProfileDto(row) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed." },
      { status: 400 },
    );
  }
}

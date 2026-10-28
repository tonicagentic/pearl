import { NextResponse } from "next/server";

import { listAppsForUser } from "@/lib/apps/create-service";
import { ensureUserForPrincipal } from "@/lib/db/issues";
import { getServerViewer } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";

/** Authenticated list of the viewer's Pearl mini apps (web + mobile). */
export async function GET() {
  const setupStatus = await getSetupStatus();
  const viewer = await getServerViewer(setupStatus);

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

  const apps = await listAppsForUser(viewer.id);
  return NextResponse.json({ apps });
}

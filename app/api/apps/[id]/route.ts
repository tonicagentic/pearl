import { NextResponse } from "next/server";

import { preferEmbedUrl } from "@/lib/apps/embed";
import { getMiniApp, toPublicMiniApp } from "@/lib/apps/queries";
import { ensureUserForPrincipal } from "@/lib/db/issues";
import { getServerViewer } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";

/** Authenticated mini app detail for the viewer (ownership enforced). */
export async function GET(
  _request: Request,
  context: { readonly params: Promise<{ readonly id: string }> },
) {
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

  const { id } = await context.params;
  const row = await getMiniApp(viewer.id, id);
  if (!row) {
    return NextResponse.json({ error: "App not found." }, { status: 404 });
  }

  const app = toPublicMiniApp(row);
  return NextResponse.json({
    app: {
      ...app,
      // Production preferred; sandbox draft preview otherwise.
      embedUrl: preferEmbedUrl(app),
    },
  });
}

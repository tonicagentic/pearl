import { NextResponse } from "next/server";

import { resetTaskListChecks, serializeTaskList } from "@/lib/db/lists";
import { getServerViewer } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";

async function requireViewer(request?: Request) {
  const setupStatus = await getSetupStatus();
  const viewer = await getServerViewer(setupStatus, request?.headers);
  if (!viewer || setupStatus.storageMode !== "database") {
    return null;
  }
  return viewer;
}

type RouteContext = {
  readonly params: Promise<{ readonly id: string }>;
};

/** Clear checkedAt on every item in the list (packing reset). */
export async function POST(request: Request, context: RouteContext) {
  const viewer = await requireViewer(request);
  if (!viewer) {
    return NextResponse.json(
      { error: "Sign in with durable storage configured." },
      { status: 401 },
    );
  }

  const { id } = await context.params;

  try {
    const list = await resetTaskListChecks(viewer.id, id);
    return NextResponse.json({ list: serializeTaskList(list) });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to reset list.";
    const status = message === "List not found." ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

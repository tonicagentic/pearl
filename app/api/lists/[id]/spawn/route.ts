import { NextResponse } from "next/server";

import { spawnTaskList } from "@/lib/db/lists";
import { todayInTimeZone } from "@/lib/lists/schedule";
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

/** Materialize list items as inbox tasks for today (manual "Add to inbox"). */
export async function POST(request: Request, context: RouteContext) {
  const viewer = await requireViewer(request);
  if (!viewer) {
    return NextResponse.json(
      { error: "Sign in with durable storage configured." },
      { status: 401 },
    );
  }

  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    readonly occurrenceDate?: string;
  };

  const occurrenceDate =
    typeof body.occurrenceDate === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(body.occurrenceDate)
      ? body.occurrenceDate
      : todayInTimeZone();

  try {
    const result = await spawnTaskList(viewer.id, id, occurrenceDate);
    return NextResponse.json({
      created: result.created,
      skipped: result.skipped,
      issueIds: result.issueIds,
      occurrenceDate,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to spawn list.";
    const status = message === "List not found." ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

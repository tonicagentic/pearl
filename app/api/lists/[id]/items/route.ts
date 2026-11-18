import { NextResponse } from "next/server";

import { createTaskListItem } from "@/lib/db/lists";
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

function serializeItem(item: {
  readonly id: string;
  readonly title: string;
  readonly notes: string | null;
  readonly sortIndex: number;
  readonly checkedAt: Date | null;
  readonly createdAt: Date;
}) {
  return {
    id: item.id,
    title: item.title,
    notes: item.notes,
    sortIndex: item.sortIndex,
    checkedAt: item.checkedAt ? item.checkedAt.toISOString() : null,
    createdAt: item.createdAt.toISOString(),
  };
}

/** Add an item to a reusable checklist. */
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
    readonly title?: string;
    readonly notes?: string | null;
    readonly sortIndex?: number;
  };

  try {
    const item = await createTaskListItem(viewer.id, id, {
      title: body.title ?? "",
      notes: body.notes,
      sortIndex: body.sortIndex,
    });
    return NextResponse.json({ item: serializeItem(item) });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create item.";
    const status = message === "List not found." ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

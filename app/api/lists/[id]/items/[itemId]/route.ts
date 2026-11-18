import { NextResponse } from "next/server";

import { deleteTaskListItem, updateTaskListItem } from "@/lib/db/lists";
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
  readonly params: Promise<{ readonly id: string; readonly itemId: string }>;
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

export async function PATCH(request: Request, context: RouteContext) {
  const viewer = await requireViewer(request);
  if (!viewer) {
    return NextResponse.json(
      { error: "Sign in with durable storage configured." },
      { status: 401 },
    );
  }

  const { id, itemId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    readonly title?: string;
    readonly notes?: string | null;
    readonly checked?: boolean;
    readonly sortIndex?: number;
  };

  try {
    const item = await updateTaskListItem(viewer.id, id, itemId, {
      ...(typeof body.title === "string" ? { title: body.title } : {}),
      ...(body.notes !== undefined ? { notes: body.notes } : {}),
      ...(typeof body.checked === "boolean" ? { checked: body.checked } : {}),
      ...(typeof body.sortIndex === "number"
        ? { sortIndex: body.sortIndex }
        : {}),
    });
    return NextResponse.json({ item: serializeItem(item) });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update item.";
    const status =
      message === "List not found." || message === "Item not found."
        ? 404
        : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const viewer = await requireViewer(request);
  if (!viewer) {
    return NextResponse.json(
      { error: "Sign in with durable storage configured." },
      { status: 401 },
    );
  }

  const { id, itemId } = await context.params;

  try {
    const deleted = await deleteTaskListItem(viewer.id, id, itemId);
    if (!deleted) {
      return NextResponse.json({ error: "Item not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete item.";
    const status = message === "List not found." ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

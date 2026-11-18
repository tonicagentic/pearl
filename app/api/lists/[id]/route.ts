import { NextResponse } from "next/server";

import {
  deleteTaskList,
  getTaskList,
  serializeTaskList,
  updateTaskList,
} from "@/lib/db/lists";
import type { TaskListCadence } from "@/lib/db/schema";
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

function parseCadence(value: unknown): TaskListCadence | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (value === "daily" || value === "weekly" || value === "monthly") {
    return value;
  }
  return undefined;
}

type RouteContext = {
  readonly params: Promise<{ readonly id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const viewer = await requireViewer(request);
  if (!viewer) {
    return NextResponse.json(
      { error: "Sign in with durable storage configured." },
      { status: 401 },
    );
  }

  const { id } = await context.params;
  const list = await getTaskList(viewer.id, id);
  if (!list) {
    return NextResponse.json({ error: "List not found." }, { status: 404 });
  }

  return NextResponse.json({ list: serializeTaskList(list) });
}

export async function PATCH(request: Request, context: RouteContext) {
  const viewer = await requireViewer(request);
  if (!viewer) {
    return NextResponse.json(
      { error: "Sign in with durable storage configured." },
      { status: 401 },
    );
  }

  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    readonly name?: string;
    readonly projectId?: string | null;
    readonly cadence?: unknown;
    readonly weekday?: number | null;
    readonly monthDay?: number | null;
  };

  const cadence = parseCadence(body.cadence);
  if (body.cadence !== undefined && cadence === undefined) {
    return NextResponse.json(
      { error: "cadence must be daily, weekly, monthly, or null." },
      { status: 400 },
    );
  }

  try {
    const list = await updateTaskList(viewer.id, id, {
      ...(typeof body.name === "string" ? { name: body.name } : {}),
      ...(body.projectId !== undefined ? { projectId: body.projectId } : {}),
      ...(cadence !== undefined
        ? {
            cadence,
            weekday: body.weekday,
            monthDay: body.monthDay,
          }
        : {
            ...(body.weekday !== undefined ? { weekday: body.weekday } : {}),
            ...(body.monthDay !== undefined
              ? { monthDay: body.monthDay }
              : {}),
          }),
    });
    return NextResponse.json({ list: serializeTaskList(list) });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update list.";
    const status = message === "List not found." ? 404 : 400;
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

  const { id } = await context.params;
  const deleted = await deleteTaskList(viewer.id, id);
  if (!deleted) {
    return NextResponse.json({ error: "List not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

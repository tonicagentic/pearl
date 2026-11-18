import { NextResponse } from "next/server";

import {
  createTaskList,
  listTaskLists,
  serializeTaskList,
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

/** Authenticated reusable checklist list/create for pearl-tasks. */
export async function GET(request: Request) {
  const viewer = await requireViewer(request);
  if (!viewer) {
    return NextResponse.json(
      { error: "Sign in with durable storage configured." },
      { status: 401 },
    );
  }

  const lists = await listTaskLists(viewer.id);
  return NextResponse.json({
    lists: lists.map(serializeTaskList),
  });
}

export async function POST(request: Request) {
  const viewer = await requireViewer(request);
  if (!viewer) {
    return NextResponse.json(
      { error: "Sign in with durable storage configured." },
      { status: 401 },
    );
  }

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
    const list = await createTaskList(viewer.id, {
      name: body.name ?? "",
      projectId: body.projectId,
      cadence: cadence ?? null,
      weekday: body.weekday,
      monthDay: body.monthDay,
    });
    return NextResponse.json({ list: serializeTaskList(list) });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to create list.",
      },
      { status: 400 },
    );
  }
}

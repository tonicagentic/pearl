import { NextResponse } from "next/server";

import {
  parseBodyGrocery,
  parseBodyMealPlan,
  parseBodySession,
  parseBodySettings,
} from "@/lib/body/validate";
import {
  deleteBodySession,
  insertBodySession,
  readBody,
  upsertBodyGrocery,
  upsertBodyMealPlan,
  upsertBodySettings,
} from "@/lib/db/body";
import { ensureUserForPrincipal } from "@/lib/db/issues";
import { getServerViewer } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";

/**
 * Body data for the phone companion. GET returns settings, the newest
 * sessions, the meal plan, and the grocery list. POST mutates with an `op`
 * field and returns that same snapshot. Authenticated the same way as
 * /api/issues: better-auth bearer, a user row, and database storage.
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

async function snapshotFor(viewer: {
  id: string;
  name: string;
  email: string;
}) {
  const body = await readBody(viewer.id);
  return {
    viewer: { id: viewer.id, name: viewer.name, email: viewer.email },
    settings: body.settings,
    sessions: body.sessions,
    mealPlan: body.mealPlan,
    grocery: body.grocery,
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

  return NextResponse.json(await snapshotFor(viewer));
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

  const op = body.op;

  try {
    if (op === "saveSettings") {
      await upsertBodySettings(viewer.id, parseBodySettings(body.settings));
    } else if (op === "logSession") {
      await insertBodySession(viewer.id, parseBodySession(body));
    } else if (op === "deleteSession") {
      const id = typeof body.id === "string" ? body.id.trim() : "";

      if (!id) {
        return NextResponse.json(
          { error: "Session id is required." },
          { status: 400 },
        );
      }

      const deleted = await deleteBodySession(viewer.id, id);

      if (!deleted) {
        return NextResponse.json(
          { error: "Session not found." },
          { status: 404 },
        );
      }
    } else if (op === "saveMealPlan") {
      await upsertBodyMealPlan(viewer.id, parseBodyMealPlan(body.mealPlan));
    } else if (op === "saveGrocery") {
      await upsertBodyGrocery(viewer.id, parseBodyGrocery(body.grocery));
    } else {
      return NextResponse.json(
        { error: `Unknown op: ${String(op)}` },
        { status: 400 },
      );
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed." },
      { status: 400 },
    );
  }

  return NextResponse.json(await snapshotFor(viewer));
}

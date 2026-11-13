import { NextResponse } from "next/server";

import { getProject } from "@/lib/db/projects";
import {
  createWorkbenchPin,
  linkPinToProject,
  listProjectPins,
  listWorkbenchPins,
} from "@/lib/db/workbench-pins";
import { getServerViewer } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";
import type { WorkbenchPin } from "@/lib/workbench/types";

function serializePin(pin: WorkbenchPin) {
  return {
    id: pin.id,
    userId: pin.userId,
    owner: pin.owner,
    name: pin.name,
    fullName: pin.fullName,
    vercelProjectId: pin.vercelProjectId ?? null,
    vercelTeamId: pin.vercelTeamId ?? null,
    expoProjectId: pin.expoProjectId ?? null,
    expoUpdateChannel: pin.expoUpdateChannel ?? null,
    createdAt: pin.createdAt,
    updatedAt: pin.updatedAt,
  };
}

async function requireViewer() {
  const setupStatus = await getSetupStatus();
  const viewer = await getServerViewer(setupStatus);
  if (!viewer || setupStatus.storageMode !== "database") {
    return null;
  }
  return viewer;
}

/** List pins linked to a project. */
export async function GET(
  _request: Request,
  context: { readonly params: Promise<{ readonly id: string }> },
) {
  const viewer = await requireViewer();
  if (!viewer) {
    return NextResponse.json(
      { error: "Sign in with durable storage configured." },
      { status: 401 },
    );
  }

  const { id: projectId } = await context.params;
  const owned = await getProject(viewer.id, projectId);
  if (!owned) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  const pins = await listProjectPins(viewer.id, projectId);
  return NextResponse.json({ pins: pins.map(serializePin) });
}

/**
 * Link an existing pin, or create-and-link a new workbench pin.
 * Body: `{ pinId }` or `{ owner, name, fullName?, vercelProjectId?, … }`.
 */
export async function POST(
  request: Request,
  context: { readonly params: Promise<{ readonly id: string }> },
) {
  const viewer = await requireViewer();
  if (!viewer) {
    return NextResponse.json(
      { error: "Sign in with durable storage configured." },
      { status: 401 },
    );
  }

  const { id: projectId } = await context.params;
  const owned = await getProject(viewer.id, projectId);
  if (!owned) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    readonly pinId?: string;
    readonly owner?: string;
    readonly name?: string;
    readonly fullName?: string;
    readonly vercelProjectId?: string | null;
    readonly vercelTeamId?: string | null;
    readonly expoProjectId?: string | null;
    readonly expoUpdateChannel?: string | null;
  };

  try {
    let pinId = body.pinId?.trim();
    if (!pinId) {
      const fullName =
        body.fullName?.trim() ||
        (body.owner && body.name ? `${body.owner}/${body.name}` : "");
      const existingPins = await listWorkbenchPins(viewer.id);
      const existing = existingPins.find(
        (pin) =>
          (fullName &&
            pin.fullName.toLowerCase() === fullName.toLowerCase()) ||
          (body.owner &&
            body.name &&
            pin.owner.toLowerCase() === body.owner.toLowerCase() &&
            pin.name.toLowerCase() === body.name.toLowerCase()),
      );
      if (existing) {
        pinId = existing.id;
      } else {
        const created = await createWorkbenchPin(viewer.id, {
          owner: body.owner,
          name: body.name,
          fullName: body.fullName,
          vercelProjectId: body.vercelProjectId,
          vercelTeamId: body.vercelTeamId,
          expoProjectId: body.expoProjectId,
          expoUpdateChannel: body.expoUpdateChannel,
        });
        pinId = created.id;
      }
    }

    const linked = await linkPinToProject(viewer.id, projectId, pinId);
    if (!linked) {
      return NextResponse.json(
        { error: "Pin not found or could not be linked." },
        { status: 404 },
      );
    }
    return NextResponse.json({ pin: serializePin(linked) });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to link pin.",
      },
      { status: 400 },
    );
  }
}

import { NextResponse } from "next/server";

import {
  assignLabelToProject,
  listLabelsForProject,
  setProjectLabels,
  unassignLabelFromProject,
} from "@/lib/db/project-labels";
import { getServerViewer } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";

async function requireViewer() {
  const setupStatus = await getSetupStatus();
  const viewer = await getServerViewer(setupStatus);
  if (!viewer || setupStatus.storageMode !== "database") {
    return null;
  }
  return viewer;
}

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

  const { id } = await context.params;
  const labels = await listLabelsForProject(viewer.id, id);
  return NextResponse.json({ labels });
}

/** Replace all labels on a project, or assign/unassign one. */
export async function PUT(
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

  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    readonly labelIds?: readonly string[];
    readonly addLabelId?: string;
    readonly removeLabelId?: string;
  };

  try {
    let labels;
    if (Array.isArray(body.labelIds)) {
      labels = await setProjectLabels(viewer.id, id, body.labelIds);
    } else if (typeof body.addLabelId === "string") {
      labels = await assignLabelToProject(viewer.id, id, body.addLabelId);
    } else if (typeof body.removeLabelId === "string") {
      labels = await unassignLabelFromProject(
        viewer.id,
        id,
        body.removeLabelId,
      );
    } else {
      return NextResponse.json(
        {
          error:
            "Provide labelIds, addLabelId, or removeLabelId.",
        },
        { status: 400 },
      );
    }

    if (!labels) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }
    return NextResponse.json({ labels });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to update project labels.",
      },
      { status: 400 },
    );
  }
}

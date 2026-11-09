import { NextResponse } from "next/server";

import {
  deleteProject,
  getProject,
  listPlans,
  listProjectChats,
  updateProject,
} from "@/lib/db/projects";
import { getServerViewer } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";

function serializeProject(row: {
  readonly id: string;
  readonly name: string;
  readonly instructions: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}) {
  return {
    id: row.id,
    name: row.name,
    instructions: row.instructions,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
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

/** Project detail: project + plans + chats. */
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
  const owned = await getProject(viewer.id, id);
  if (!owned) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  const [plans, chats] = await Promise.all([
    listPlans(viewer.id, owned.id),
    listProjectChats(viewer.id, owned.id),
  ]);

  return NextResponse.json({
    project: serializeProject(owned),
    plans: plans.map((row) => ({
      id: row.id,
      title: row.title,
      slug: row.slug,
      updatedAt: row.updatedAt.toISOString(),
    })),
    chats: chats.map((row) => ({
      id: row.id,
      title: row.title,
      updatedAt: row.updatedAt.toISOString(),
    })),
  });
}

export async function PATCH(
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
    readonly name?: string;
    readonly instructions?: string;
  };

  try {
    const project = await updateProject(viewer.id, id, body);
    if (!project) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }
    return NextResponse.json({ project: serializeProject(project) });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to update project.",
      },
      { status: 400 },
    );
  }
}

export async function DELETE(
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
  const deleted = await deleteProject(viewer.id, id);
  if (!deleted) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

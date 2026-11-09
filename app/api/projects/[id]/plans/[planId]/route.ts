import { NextResponse } from "next/server";

import { createChat } from "@/lib/db/queries";
import {
  deletePlan,
  getPlan,
  getProject,
  savePlan,
} from "@/lib/db/projects";
import { getServerViewer } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";

function serializePlan(row: {
  readonly id: string;
  readonly projectId: string;
  readonly title: string;
  readonly slug: string;
  readonly markdown: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}) {
  return {
    id: row.id,
    projectId: row.projectId,
    title: row.title,
    slug: row.slug,
    markdown: row.markdown,
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

async function loadOwnedPlan(userId: string, projectId: string, planId: string) {
  const owned = await getProject(userId, projectId);
  if (!owned) return { error: "Project not found." as const, status: 404 as const };
  const plan = await getPlan(userId, planId);
  if (!plan || plan.projectId !== projectId) {
    return { error: "Plan not found." as const, status: 404 as const };
  }
  return { project: owned, plan };
}

export async function GET(
  _request: Request,
  context: {
    readonly params: Promise<{ readonly id: string; readonly planId: string }>;
  },
) {
  const viewer = await requireViewer();
  if (!viewer) {
    return NextResponse.json(
      { error: "Sign in with durable storage configured." },
      { status: 401 },
    );
  }

  const { id, planId } = await context.params;
  const loaded = await loadOwnedPlan(viewer.id, id, planId);
  if ("error" in loaded) {
    return NextResponse.json({ error: loaded.error }, { status: loaded.status });
  }

  return NextResponse.json({ plan: serializePlan(loaded.plan) });
}

export async function PATCH(
  request: Request,
  context: {
    readonly params: Promise<{ readonly id: string; readonly planId: string }>;
  },
) {
  const viewer = await requireViewer();
  if (!viewer) {
    return NextResponse.json(
      { error: "Sign in with durable storage configured." },
      { status: 401 },
    );
  }

  const { id, planId } = await context.params;
  const loaded = await loadOwnedPlan(viewer.id, id, planId);
  if ("error" in loaded) {
    return NextResponse.json({ error: loaded.error }, { status: loaded.status });
  }

  const body = (await request.json().catch(() => ({}))) as {
    readonly title?: string;
    readonly markdown?: string;
    readonly slug?: string;
  };

  try {
    const plan = await savePlan(viewer.id, {
      projectId: id,
      planId,
      title: body.title ?? loaded.plan.title,
      markdown: body.markdown ?? loaded.plan.markdown,
      slug: body.slug,
    });
    return NextResponse.json({ plan: serializePlan(plan) });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to update plan.",
      },
      { status: 400 },
    );
  }
}

export async function DELETE(
  _request: Request,
  context: {
    readonly params: Promise<{ readonly id: string; readonly planId: string }>;
  },
) {
  const viewer = await requireViewer();
  if (!viewer) {
    return NextResponse.json(
      { error: "Sign in with durable storage configured." },
      { status: 401 },
    );
  }

  const { id, planId } = await context.params;
  const loaded = await loadOwnedPlan(viewer.id, id, planId);
  if ("error" in loaded) {
    return NextResponse.json({ error: loaded.error }, { status: loaded.status });
  }

  await deletePlan(viewer.id, planId);
  return NextResponse.json({ ok: true });
}

/** Carry out a plan: create a project chat with the standard prompt. */
export async function POST(
  request: Request,
  context: {
    readonly params: Promise<{ readonly id: string; readonly planId: string }>;
  },
) {
  const viewer = await requireViewer();
  if (!viewer) {
    return NextResponse.json(
      { error: "Sign in with durable storage configured." },
      { status: 401 },
    );
  }

  const { id, planId } = await context.params;
  const loaded = await loadOwnedPlan(viewer.id, id, planId);
  if ("error" in loaded) {
    return NextResponse.json({ error: loaded.error }, { status: loaded.status });
  }

  const body = (await request.json().catch(() => ({}))) as {
    readonly op?: string;
  };

  if (body.op !== "carryOut") {
    return NextResponse.json(
      { error: 'Unsupported operation. Use op: "carryOut".' },
      { status: 400 },
    );
  }

  const message =
    `Carry out the plan "${loaded.plan.title}" (id: ${loaded.plan.id}). ` +
    `Call read_plan first, then do what it says.`;

  const created = await createChat(viewer.id, {
    pendingUserMessage: message,
    projectId: loaded.plan.projectId,
  });

  return NextResponse.json({
    chatId: created.id,
    projectId: loaded.plan.projectId,
  });
}

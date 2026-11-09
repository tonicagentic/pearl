import { NextResponse } from "next/server";

import { getProject, savePlan } from "@/lib/db/projects";
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

/** Create a plan in a project. */
export async function POST(
  request: Request,
  context: { readonly params: Promise<{ readonly id: string }> },
) {
  const setupStatus = await getSetupStatus();
  const viewer = await getServerViewer(setupStatus);

  if (!viewer || setupStatus.storageMode !== "database") {
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
    readonly title?: string;
    readonly markdown?: string;
    readonly slug?: string;
  };

  try {
    const plan = await savePlan(viewer.id, {
      projectId,
      title: body.title ?? "Untitled plan",
      markdown: body.markdown ?? "",
      slug: body.slug,
    });
    return NextResponse.json({ plan: serializePlan(plan) });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to create plan.",
      },
      { status: 400 },
    );
  }
}

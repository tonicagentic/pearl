import { NextResponse } from "next/server";

import { createProject, listProjects } from "@/lib/db/projects";
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

/** Authenticated project list/create for web + mobile. */
export async function GET() {
  const setupStatus = await getSetupStatus();
  const viewer = await getServerViewer(setupStatus);

  if (!viewer || setupStatus.storageMode !== "database") {
    return NextResponse.json(
      { error: "Sign in with durable storage configured." },
      { status: 401 },
    );
  }

  const projects = await listProjects(viewer.id);
  return NextResponse.json({
    projects: projects.map(serializeProject),
  });
}

export async function POST(request: Request) {
  const setupStatus = await getSetupStatus();
  const viewer = await getServerViewer(setupStatus);

  if (!viewer || setupStatus.storageMode !== "database") {
    return NextResponse.json(
      { error: "Sign in with durable storage configured." },
      { status: 401 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    readonly name?: string;
    readonly instructions?: string;
  };

  try {
    const project = await createProject(viewer.id, {
      name: body.name ?? "",
      instructions: body.instructions,
    });
    return NextResponse.json({ project: serializeProject(project) });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to create project.",
      },
      { status: 400 },
    );
  }
}

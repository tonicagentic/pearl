import { NextResponse } from "next/server";

import { createChat } from "@/lib/db/queries";
import { getProject } from "@/lib/db/projects";
import { unlinkArtifactFromProject } from "@/lib/db/project-artifacts";
import {
  readProjectFileByArtifactId,
  updateProjectFile,
} from "@/lib/project-files";
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
  context: {
    readonly params: Promise<{
      readonly id: string;
      readonly artifactId: string;
    }>;
  },
) {
  const viewer = await requireViewer();
  if (!viewer) {
    return NextResponse.json(
      { error: "Sign in with durable storage configured." },
      { status: 401 },
    );
  }

  const { id: projectId, artifactId } = await context.params;
  const owned = await getProject(viewer.id, projectId);
  if (!owned) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  try {
    const file = await readProjectFileByArtifactId({
      userId: viewer.id,
      projectId,
      artifactId,
    });
    if (!file) {
      return NextResponse.json({ error: "File not found." }, { status: 404 });
    }
    return NextResponse.json({
      artifact: file.artifact,
      content: file.markdown,
      path: file.path,
      title: file.title,
      slug: file.slug,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to read file.",
      },
      { status: 400 },
    );
  }
}

export async function PATCH(
  request: Request,
  context: {
    readonly params: Promise<{
      readonly id: string;
      readonly artifactId: string;
    }>;
  },
) {
  const viewer = await requireViewer();
  if (!viewer) {
    return NextResponse.json(
      { error: "Sign in with durable storage configured." },
      { status: 401 },
    );
  }

  const { id: projectId, artifactId } = await context.params;
  const owned = await getProject(viewer.id, projectId);
  if (!owned) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    readonly title?: string;
    readonly content?: string;
  };

  try {
    const file = await updateProjectFile({
      userId: viewer.id,
      projectId,
      artifactId,
      title: body.title,
      content: body.content,
    });
    return NextResponse.json({
      artifact: file.artifact,
      content: file.markdown,
      path: file.path,
      title: file.title,
      slug: file.slug,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to update file.",
      },
      { status: 400 },
    );
  }
}

export async function DELETE(
  _request: Request,
  context: {
    readonly params: Promise<{
      readonly id: string;
      readonly artifactId: string;
    }>;
  },
) {
  const viewer = await requireViewer();
  if (!viewer) {
    return NextResponse.json(
      { error: "Sign in with durable storage configured." },
      { status: 401 },
    );
  }

  const { id: projectId, artifactId } = await context.params;
  const owned = await getProject(viewer.id, projectId);
  if (!owned) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  const ok = await unlinkArtifactFromProject(
    viewer.id,
    projectId,
    artifactId,
  );
  if (!ok) {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

/** Carry out a project file (typically a plan markdown). */
export async function POST(
  request: Request,
  context: {
    readonly params: Promise<{
      readonly id: string;
      readonly artifactId: string;
    }>;
  },
) {
  const viewer = await requireViewer();
  if (!viewer) {
    return NextResponse.json(
      { error: "Sign in with durable storage configured." },
      { status: 401 },
    );
  }

  const { id: projectId, artifactId } = await context.params;
  const owned = await getProject(viewer.id, projectId);
  if (!owned) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
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

  try {
    const file = await readProjectFileByArtifactId({
      userId: viewer.id,
      projectId,
      artifactId,
    });
    if (!file) {
      return NextResponse.json({ error: "File not found." }, { status: 404 });
    }

    const message =
      `Carry out the plan "${file.title}" at ${file.path}. ` +
      `Call read_project_file (or read_file) on that path first, then do what it says.`;

    const created = await createChat(viewer.id, {
      pendingUserMessage: message,
      projectId,
    });

    return NextResponse.json({
      chatId: created.id,
      projectId,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to carry out file.",
      },
      { status: 400 },
    );
  }
}

import { NextResponse } from "next/server";

import { getProject } from "@/lib/db/projects";
import {
  listProjectFiles,
  putProjectMarkdownFile,
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

/** List project files (Library artifacts linked to the project). */
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

  const artifacts = await listProjectFiles(viewer.id, projectId);
  return NextResponse.json({ artifacts });
}

/** Create a markdown project file. Body: `{ title, markdown?, slug? }`. */
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
    readonly title?: string;
    readonly markdown?: string;
    readonly slug?: string;
  };

  try {
    const written = await putProjectMarkdownFile({
      userId: viewer.id,
      projectId,
      title: typeof body.title === "string" ? body.title : "",
      markdown:
        typeof body.markdown === "string"
          ? body.markdown
          : `# ${(body.title ?? "Untitled").trim()}\n\n`,
      slug: typeof body.slug === "string" ? body.slug : undefined,
    });
    return NextResponse.json({
      artifact: written.artifact,
      path: written.path,
      slug: written.slug,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to create file.",
      },
      { status: 400 },
    );
  }
}

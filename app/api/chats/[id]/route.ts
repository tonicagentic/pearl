import { NextResponse } from "next/server";
import {
  deleteChatForUser,
  getChatForUser,
  updateChatTitleForUser,
} from "@/lib/db/queries";
import { setChatProject } from "@/lib/db/projects";
import { getServerViewer } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";

export async function GET(
  _request: Request,
  { params }: { readonly params: Promise<{ readonly id: string }> },
) {
  const setupStatus = await getSetupStatus();

  if (!setupStatus.appReady || setupStatus.storageMode !== "database") {
    return NextResponse.json({ chat: null }, { status: 503 });
  }

  const viewer = await getServerViewer(setupStatus);

  if (!viewer) {
    return NextResponse.json({ chat: null }, { status: 401 });
  }

  const { id } = await params;
  const chat = await getChatForUser(id, viewer.id);

  if (!chat) {
    return NextResponse.json({ chat: null }, { status: 404 });
  }

  return NextResponse.json({ chat });
}

/** Rename and/or attach (or detach) a chat to a project. */
export async function PATCH(
  request: Request,
  { params }: { readonly params: Promise<{ readonly id: string }> },
) {
  const setupStatus = await getSetupStatus();

  if (!setupStatus.appReady || setupStatus.storageMode !== "database") {
    return NextResponse.json({ error: "Unavailable." }, { status: 503 });
  }

  const viewer = await getServerViewer(setupStatus);

  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;
  const chat = await getChatForUser(id, viewer.id);

  if (!chat) {
    return NextResponse.json({ error: "Chat not found." }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    readonly projectId?: string | null;
    readonly title?: string;
  };

  const hasProject = body.projectId !== undefined;
  const hasTitle = typeof body.title === "string";

  if (!hasProject && !hasTitle) {
    return NextResponse.json(
      { error: "Provide title and/or projectId (string or null)." },
      { status: 400 },
    );
  }

  let title: string | undefined;
  let updatedAt: string | undefined;
  let projectId: string | null | undefined;

  if (hasTitle) {
    try {
      const renamed = await updateChatTitleForUser(id, viewer.id, body.title!);
      if (!renamed) {
        return NextResponse.json({ error: "Chat not found." }, { status: 404 });
      }
      title = renamed.title;
      updatedAt = renamed.updatedAt;
    } catch (cause) {
      return NextResponse.json(
        {
          error:
            cause instanceof Error ? cause.message : "Could not rename chat.",
        },
        { status: 400 },
      );
    }
  }

  if (hasProject) {
    const ok = await setChatProject(viewer.id, id, body.projectId!);
    if (!ok) {
      return NextResponse.json(
        { error: "Could not attach chat to project." },
        { status: 400 },
      );
    }
    projectId = body.projectId!;
  }

  return NextResponse.json({
    ok: true,
    ...(title !== undefined ? { title, updatedAt } : {}),
    ...(projectId !== undefined ? { projectId } : {}),
  });
}

export async function DELETE(
  _request: Request,
  { params }: { readonly params: Promise<{ readonly id: string }> },
) {
  const setupStatus = await getSetupStatus();

  if (!setupStatus.appReady || setupStatus.storageMode !== "database") {
    return NextResponse.json({ ok: false }, { status: 503 });
  }

  const viewer = await getServerViewer(setupStatus);

  if (!viewer) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const { id } = await params;
  const chat = await getChatForUser(id, viewer.id);

  if (!chat) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  await deleteChatForUser(id, viewer.id);

  return NextResponse.json({ ok: true });
}

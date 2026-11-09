import { NextResponse } from "next/server";
import { deleteChatForUser, getChatForUser } from "@/lib/db/queries";
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

/** Attach (or detach) a chat to a project. */
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
  };

  if (body.projectId === undefined) {
    return NextResponse.json(
      { error: "projectId is required (string or null)." },
      { status: 400 },
    );
  }

  const ok = await setChatProject(viewer.id, id, body.projectId);
  if (!ok) {
    return NextResponse.json(
      { error: "Could not attach chat to project." },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true, projectId: body.projectId });
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

import { NextResponse } from "next/server";
import { deleteChatForUser, getChatForUser } from "@/lib/db/queries";
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

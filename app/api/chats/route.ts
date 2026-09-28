import { NextResponse } from "next/server";
import { createChatAction } from "@/app/actions/chat";
import { listChatsPageByUser } from "@/lib/db/queries";
import { getServerViewer } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";

export async function GET(request: Request) {
  const setupStatus = await getSetupStatus();

  if (!setupStatus.appReady || setupStatus.storageMode !== "database") {
    return NextResponse.json({ chats: [], nextCursor: null });
  }

  const viewer = await getServerViewer(setupStatus);

  if (!viewer) {
    return NextResponse.json({ chats: [], nextCursor: null }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = await listChatsPageByUser(viewer.id, searchParams.get("cursor"));

  return NextResponse.json({
    chats: page.items,
    nextCursor: page.nextCursor,
  });
}

// Mobile: creating a chat goes through the same server action the web uses,
// so rate limiting, viewer resolution, and title derivation stay identical.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    readonly pendingUserMessage?: string;
  };

  const created = await createChatAction({
    pendingUserMessage: body.pendingUserMessage,
  });

  return NextResponse.json({ chat: created });
}

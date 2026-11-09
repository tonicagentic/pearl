import { NextResponse } from "next/server";
import { assertChatMessageLength } from "@/lib/chat/limits";
import { createChat, listChatsPageByUser } from "@/lib/db/queries";
import { RateLimitError, enforceRateLimit } from "@/lib/rate-limit";
import { getServerViewer } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";

const SEND_LIMIT = 25;
const SEND_WINDOW_SECONDS = 60 * 60;

export async function GET(request: Request) {
  const setupStatus = await getSetupStatus();

  if (!setupStatus.appReady || setupStatus.storageMode !== "database") {
    return NextResponse.json({ chats: [], nextCursor: null });
  }

  const viewer = await getServerViewer(setupStatus, request.headers);

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

// Mobile Bearer auth is visible to Route Handlers via headers(), but nested
// "use server" actions can lose that request context and throw "Sign in…",
// which used to surface as an opaque 500 mid-send. Keep create in the route.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    readonly pendingUserMessage?: string;
    readonly projectId?: string | null;
  };

  const setupStatus = await getSetupStatus();
  if (!setupStatus.appReady || setupStatus.storageMode !== "database") {
    return NextResponse.json(
      { error: "Database persistence is not enabled." },
      { status: 503 },
    );
  }
  const viewer = await getServerViewer(setupStatus, request.headers);
  if (!viewer) {
    return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  }

  try {
    if (body.pendingUserMessage) {
      assertChatMessageLength(body.pendingUserMessage);
    }
    await enforceRateLimit({
      key: viewer.id,
      limit: SEND_LIMIT,
      prefix: "chat:create",
      windowSeconds: SEND_WINDOW_SECONDS,
    });
    const created = await createChat(viewer.id, {
      pendingUserMessage: body.pendingUserMessage,
      projectId: body.projectId,
    });
    return NextResponse.json({ chat: created });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: error.message, retryAfter: error.retryAfter },
        { status: 429 },
      );
    }
    if (error instanceof Error && error.message === "Sign in to continue.") {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    throw error;
  }
}

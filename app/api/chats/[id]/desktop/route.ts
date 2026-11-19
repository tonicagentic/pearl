import { NextResponse } from "next/server";

import {
  ensureDesktopSession,
  publicDesktopView,
} from "@/lib/desktop/session";
import { getChatForUser } from "@/lib/db/queries";
import { getServerViewer } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";

async function requireChatOwner(chatId: string, requestHeaders?: Headers) {
  const setupStatus = await getSetupStatus();

  if (!setupStatus.appReady || setupStatus.storageMode !== "database") {
    return {
      error: NextResponse.json(
        { error: "Desktop streaming requires database storage." },
        { status: 503 },
      ),
    } as const;
  }

  const viewer = await getServerViewer(setupStatus, requestHeaders);
  if (!viewer) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    } as const;
  }

  const chat = await getChatForUser(chatId, viewer.id);
  if (!chat) {
    return {
      error: NextResponse.json({ error: "Chat not found" }, { status: 404 }),
    } as const;
  }

  return { chatId, viewerId: viewer.id } as const;
}

/** Mint the viewer URL for the chat's screen-relay desktop (auth-gated). */
export async function GET(
  request: Request,
  { params }: { readonly params: Promise<{ readonly id: string }> },
) {
  const { id } = await params;
  const gate = await requireChatOwner(id, request.headers);
  if ("error" in gate) return gate.error;

  try {
    const handle = await ensureDesktopSession(id, { userId: gate.viewerId });
    return NextResponse.json(publicDesktopView(handle));
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to start desktop session",
      },
      { status: 502 },
    );
  }
}

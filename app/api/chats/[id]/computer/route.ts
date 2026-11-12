import { NextResponse } from "next/server";

import { chatNeedsUserInput } from "@/lib/chat/events";
import {
  getChatBrowserSession,
  getChatForUser,
  listAgentFiles,
} from "@/lib/db/queries";
import { getServerViewer } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";

/**
 * Aggregate Computer-tab snapshot for a chat.
 * Does not mint a browser sandbox or return control secrets.
 */
export async function GET(
  _request: Request,
  { params }: { readonly params: Promise<{ readonly id: string }> },
) {
  const setupStatus = await getSetupStatus();

  if (!setupStatus.appReady || setupStatus.storageMode !== "database") {
    return NextResponse.json(
      { error: "Computer state requires database storage." },
      { status: 503 },
    );
  }

  const viewer = await getServerViewer(setupStatus);
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const chat = await getChatForUser(id, viewer.id);
  if (!chat) {
    return NextResponse.json({ error: "Chat not found" }, { status: 404 });
  }

  const [files, browser] = await Promise.all([
    listAgentFiles(id),
    getChatBrowserSession(id),
  ]);

  return NextResponse.json({
    session: chat.session ?? null,
    waitingForInput: chatNeedsUserInput(chat.events),
    files,
    browser: { active: Boolean(browser?.browserSandboxName) },
  });
}

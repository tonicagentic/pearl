import { NextResponse } from "next/server";

import { callBrowserAction } from "@/lib/browser/client";
import {
  ensureBrowserSession,
  publicBrowserView,
} from "@/lib/browser/session";
import type { BrowserControlMode } from "@/lib/browser/types";
import { getChatForUser } from "@/lib/db/queries";
import { getServerViewer } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";

async function requireChatOwner(chatId: string) {
  const setupStatus = await getSetupStatus();

  if (!setupStatus.appReady || setupStatus.storageMode !== "database") {
    return {
      error: NextResponse.json(
        { error: "Browser collaboration requires database storage." },
        { status: 503 },
      ),
    } as const;
  }

  const viewer = await getServerViewer(setupStatus);
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

/** Mint the viewer URL for the chat's live browser (auth-gated). */
export async function GET(
  _request: Request,
  { params }: { readonly params: Promise<{ readonly id: string }> },
) {
  const { id } = await params;
  const gate = await requireChatOwner(id);
  if ("error" in gate) return gate.error;

  try {
    const handle = await ensureBrowserSession(id);
    return NextResponse.json(publicBrowserView(handle));
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to start browser session",
      },
      { status: 502 },
    );
  }
}

/**
 * Control-plane actions from the UI: takeover / hand back, select Chromium
 * tab, heartbeat. Never returns the control secret.
 */
export async function POST(
  request: Request,
  { params }: { readonly params: Promise<{ readonly id: string }> },
) {
  const { id } = await params;
  const gate = await requireChatOwner(id);
  if ("error" in gate) return gate.error;

  let body: {
    readonly op?: string;
    readonly mode?: BrowserControlMode;
    readonly tabId?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const handle = await ensureBrowserSession(id);

    if (body.op === "control" && (body.mode === "agent" || body.mode === "user")) {
      const result = await callBrowserAction(handle, {
        action: "control",
        mode: body.mode,
      });
      return NextResponse.json({
        ok: result.ok,
        controlMode: result.controlMode,
        note: result.note,
      });
    }

    if (body.op === "select" && typeof body.tabId === "string") {
      const result = await callBrowserAction(handle, {
        action: "tabs",
        op: "select",
        tabId: body.tabId,
      });
      return NextResponse.json({
        ok: result.ok,
        controlMode: result.controlMode,
        tabs: result.tabs,
        note: result.note,
      });
    }

    if (body.op === "heartbeat") {
      const result = await callBrowserAction(handle, { action: "heartbeat" });
      return NextResponse.json({
        ok: result.ok,
        controlMode: result.controlMode,
        tabs: result.tabs,
        url: result.url,
        title: result.title,
      });
    }

    return NextResponse.json({ error: "Unknown op" }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to reach browser session",
      },
      { status: 502 },
    );
  }
}

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

async function requireChatOwner(chatId: string, requestHeaders?: Headers) {
  const setupStatus = await getSetupStatus();

  if (!setupStatus.appReady || setupStatus.storageMode !== "database") {
    return {
      error: NextResponse.json(
        { error: "Browser collaboration requires database storage." },
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

/** Mint the viewer URL for the chat's live browser (auth-gated). */
export async function GET(
  request: Request,
  { params }: { readonly params: Promise<{ readonly id: string }> },
) {
  const { id } = await params;
  const gate = await requireChatOwner(id, request.headers);
  if ("error" in gate) return gate.error;

  try {
    const handle = await ensureBrowserSession(id, { userId: gate.viewerId });
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

type BrowserUiBody = {
  readonly op?: string;
  readonly mode?: BrowserControlMode;
  readonly tabId?: string;
  readonly url?: string;
};

function jsonResult(result: {
  readonly ok: boolean;
  readonly controlMode: BrowserControlMode;
  readonly tabs: readonly unknown[];
  readonly url: string | null;
  readonly title: string | null;
  readonly note?: string;
}) {
  return NextResponse.json({
    ok: result.ok,
    controlMode: result.controlMode,
    tabs: result.tabs,
    url: result.url,
    title: result.title,
    note: result.note,
  });
}

/**
 * Control-plane actions from the UI: takeover / hand back, select / create /
 * close Chromium tabs, navigate, back / forward / reload, heartbeat.
 * Never returns the control secret. User chrome ops set fromUser so the
 * sandbox claims user control and allows the action.
 */
export async function POST(
  request: Request,
  { params }: { readonly params: Promise<{ readonly id: string }> },
) {
  const { id } = await params;
  const gate = await requireChatOwner(id, request.headers);
  if ("error" in gate) return gate.error;

  let body: BrowserUiBody;
  try {
    body = (await request.json()) as BrowserUiBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const handle = await ensureBrowserSession(id, { userId: gate.viewerId });
    const user = { fromUser: true as const };

    if (body.op === "control" && (body.mode === "agent" || body.mode === "user")) {
      const result = await callBrowserAction(handle, {
        action: "control",
        mode: body.mode,
      });
      return jsonResult(result);
    }

    if (body.op === "select" && typeof body.tabId === "string") {
      const result = await callBrowserAction(
        handle,
        { action: "tabs", op: "select", tabId: body.tabId },
        user,
      );
      return jsonResult(result);
    }

    if (body.op === "new") {
      const result = await callBrowserAction(
        handle,
        {
          action: "tabs",
          op: "new",
          ...(typeof body.url === "string" ? { url: body.url } : {}),
        },
        user,
      );
      return jsonResult(result);
    }

    if (body.op === "close" && typeof body.tabId === "string") {
      const result = await callBrowserAction(
        handle,
        { action: "tabs", op: "close", tabId: body.tabId },
        user,
      );
      return jsonResult(result);
    }

    if (body.op === "navigate" && typeof body.url === "string") {
      const result = await callBrowserAction(
        handle,
        {
          action: "navigate",
          url: body.url,
          ...(typeof body.tabId === "string" ? { tabId: body.tabId } : {}),
        },
        user,
      );
      return jsonResult(result);
    }

    if (body.op === "back" || body.op === "forward" || body.op === "reload") {
      const result = await callBrowserAction(
        handle,
        {
          action: body.op,
          ...(typeof body.tabId === "string" ? { tabId: body.tabId } : {}),
        },
        user,
      );
      return jsonResult(result);
    }

    if (body.op === "heartbeat") {
      const result = await callBrowserAction(handle, { action: "heartbeat" });
      return jsonResult(result);
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

import { defineDynamic, defineTool } from "eve/tools";
import { toolSurfaceEnabled } from "#lib/lane-state.js";
import { z } from "zod";

import {
  ensureDesktopSession,
  stopDesktopSession,
} from "@/lib/desktop/session";
import type { DesktopActionResult } from "@/lib/desktop/types";
import { getChatLinkByEveSessionId } from "@/lib/db/queries";
import { getSetupStatus } from "@/lib/setup";

const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("start"),
  }),
  z.object({
    action: z.literal("status"),
  }),
  z.object({
    action: z.literal("stop"),
  }),
]);

function unavailable(note: string): DesktopActionResult {
  return { ok: false, ready: false, note };
}

const tool = defineTool({
  description:
    "Start a live Linux desktop in a Vercel Sandbox via screen-relay so the " +
    "user can watch (and take control of) the sandbox screen in Computer. " +
    "Use when the user asks to see the desktop, a GUI app, or the sandbox " +
    "screen. Prefer browser for collaborative web pages. Do not invent or " +
    "repeat viewer links — the UI opens the stream itself.",
  inputSchema: actionSchema,
  label: {
    start(input) {
      switch (input.action) {
        case "start":
          return "Starting desktop";
        case "status":
          return "Checking desktop";
        case "stop":
          return "Stopping desktop";
        default:
          return "Desktop";
      }
    },
    complete(input) {
      switch (input.action) {
        case "start":
          return "Desktop ready";
        case "status":
          return "Checked desktop";
        case "stop":
          return "Desktop stopped";
        default:
          return "Finished desktop step";
      }
    },
  },
  async execute(input, ctx): Promise<DesktopActionResult> {
    const setup = await getSetupStatus();
    if (!setup.appReady || setup.storageMode !== "database") {
      return unavailable(
        "Live desktop is not available in local browser-storage mode.",
      );
    }

    const chatLink = await getChatLinkByEveSessionId(ctx.session.id);
    if (!chatLink) {
      return unavailable(
        "No chat is linked to this session yet, so the desktop cannot start.",
      );
    }

    try {
      if (input.action === "stop") {
        const stopped = await stopDesktopSession(chatLink.id);
        return {
          ok: stopped.ok,
          ready: false,
          note: stopped.note,
        };
      }

      if (input.action === "status") {
        const { getChatDesktopSession } = await import("@/lib/db/queries");
        const row = await getChatDesktopSession(chatLink.id);
        const ready = Boolean(row?.desktopViewerUrl);
        return {
          ok: true,
          ready,
          note: ready
            ? "Desktop stream is available in Computer."
            : "Desktop is not running. Call start to open it.",
        };
      }

      await ensureDesktopSession(chatLink.id, {
        userId: chatLink.userId,
      });
      return {
        ok: true,
        ready: true,
        note: "Desktop is streaming. The user can watch it in Computer.",
      };
    } catch (error) {
      return unavailable(
        error instanceof Error
          ? error.message
          : "Failed to reach the live desktop",
      );
    }
  },
});

export default defineDynamic(() => (toolSurfaceEnabled() ? tool : null));

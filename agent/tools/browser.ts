import { defineTool } from "eve/tools";
import { z } from "zod";

import { callBrowserAction } from "@/lib/browser/client";
import { ensureBrowserSession } from "@/lib/browser/session";
import { getChatLinkByEveSessionId } from "@/lib/db/queries";
import { getSetupStatus } from "@/lib/setup";

const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("navigate"),
    url: z.string().url().describe("Absolute http(s) URL to open."),
    tabId: z.string().optional(),
  }),
  z.object({
    action: z.literal("snapshot"),
    tabId: z.string().optional(),
  }),
  z.object({
    action: z.literal("click"),
    ref: z.string().min(1).describe("Element ref from the latest snapshot (e1, e2, …)."),
    tabId: z.string().optional(),
  }),
  z.object({
    action: z.literal("type"),
    ref: z.string().min(1),
    text: z.string(),
    tabId: z.string().optional(),
    submit: z.boolean().optional(),
  }),
  z.object({
    action: z.literal("press"),
    key: z.string().min(1).describe("Playwright key name, e.g. Enter, Escape, Meta+l."),
    tabId: z.string().optional(),
  }),
  z.object({
    action: z.literal("scroll"),
    direction: z.enum(["up", "down"]),
    tabId: z.string().optional(),
  }),
  z.object({
    action: z.literal("tabs"),
    op: z.enum(["list", "new", "select", "close"]),
    tabId: z.string().optional(),
    url: z.string().url().optional(),
  }),
]);

export default defineTool({
  description:
    "Drive a live collaborative browser the user can watch and take over. " +
    "Use when you and the user should look at a page together. Prefer web_fetch " +
    "for a one-shot read that does not need to stay open. Call snapshot after " +
    "navigate before click/type. If the result says the user has control, stop " +
    "and wait — do not retry. Call confirm_step before submit, pay, send, or delete.",
  inputSchema: actionSchema,
  async execute(input, ctx) {
    const setup = await getSetupStatus();
    if (!setup.appReady || setup.storageMode !== "database") {
      return {
        ok: false,
        controlMode: "agent" as const,
        url: null,
        title: null,
        tabs: [],
        snapshot: null,
        note: "Live browser is not available in local browser-storage mode. Use web_fetch instead.",
      };
    }

    const chatLink = await getChatLinkByEveSessionId(ctx.session.id);
    if (!chatLink) {
      return {
        ok: false,
        controlMode: "agent" as const,
        url: null,
        title: null,
        tabs: [],
        snapshot: null,
        note: "No chat is linked to this session yet, so the live browser cannot start.",
      };
    }

    try {
      const handle = await ensureBrowserSession(chatLink.id);

      if (input.action === "tabs") {
        if (input.op === "list") {
          return callBrowserAction(handle, { action: "tabs", op: "list" });
        }
        if (input.op === "new") {
          return callBrowserAction(handle, {
            action: "tabs",
            op: "new",
            url: input.url,
          });
        }
        if (input.op === "select") {
          if (!input.tabId) {
            return {
              ok: false,
              controlMode: "agent" as const,
              url: null,
              title: null,
              tabs: [],
              snapshot: null,
              note: "tabId is required to select a tab",
            };
          }
          return callBrowserAction(handle, {
            action: "tabs",
            op: "select",
            tabId: input.tabId,
          });
        }
        if (!input.tabId) {
          return {
            ok: false,
            controlMode: "agent" as const,
            url: null,
            title: null,
            tabs: [],
            snapshot: null,
            note: "tabId is required to close a tab",
          };
        }
        return callBrowserAction(handle, {
          action: "tabs",
          op: "close",
          tabId: input.tabId,
        });
      }

      return callBrowserAction(handle, input);
    } catch (error) {
      return {
        ok: false,
        controlMode: "agent" as const,
        url: null,
        title: null,
        tabs: [],
        snapshot: null,
        note:
          error instanceof Error
            ? error.message
            : "Failed to reach the live browser",
      };
    }
  },
});

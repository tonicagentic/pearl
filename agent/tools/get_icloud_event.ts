import { defineDynamic, defineTool } from "eve/tools";
import { z } from "zod";

import {
  getEventForAccount,
  publicEventFields,
} from "@/lib/calendar/icloud-accounts";
import { IcloudCalDavError } from "@/lib/calendar/icloud-caldav";
import { SecretCryptoError } from "@/lib/crypto/secrets";
import { gatedToolExport } from "../lib/gated-tool.js";
import { isBetterAuthUserPrincipal } from "../lib/user-connection.js";

const tool = defineTool({
  description:
    "Read one iCloud calendar event by eventUrl (from list_icloud_events or " +
    "search_icloud_events). Optionally pass start/end to narrow the fetch " +
    "window. For Google Calendar use the Google MCP get_event tool instead.",
  inputSchema: z.object({
    accountId: z.string().min(1),
    calendarUrl: z.string().url(),
    eventUrl: z.string().url(),
    start: z.string().optional(),
    end: z.string().optional(),
  }),
  async execute(input, ctx) {
    const principal = ctx.session.auth.current;
    if (!isBetterAuthUserPrincipal(principal) || !principal?.principalId) {
      return {
        status: "error",
        error:
          "Sign in with a personal account and connect iCloud Calendar in Settings → Calendar.",
      };
    }
    try {
      const event = await getEventForAccount({
        userId: principal.principalId,
        accountId: input.accountId,
        calendarUrl: input.calendarUrl,
        eventUrl: input.eventUrl,
        start: input.start,
        end: input.end,
      });
      if (!event) {
        return { status: "error", error: "Event not found." };
      }
      return { status: "ok", event: publicEventFields(event) };
    } catch (cause) {
      if (
        cause instanceof IcloudCalDavError ||
        cause instanceof SecretCryptoError
      ) {
        return { status: "error", error: cause.message };
      }
      return { status: "error", error: "Could not read iCloud event." };
    }
  },
});

export default defineDynamic(gatedToolExport("icloud", tool));

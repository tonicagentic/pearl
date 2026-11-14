import { defineDynamic, defineTool } from "eve/tools";
import { z } from "zod";

import {
  publicEventFields,
  searchEventsForAccount,
} from "@/lib/calendar/icloud-accounts";
import { IcloudCalDavError } from "@/lib/calendar/icloud-caldav";
import { SecretCryptoError } from "@/lib/crypto/secrets";
import { toolSurfaceEnabled } from "../lib/lane-state.js";
import { isBetterAuthUserPrincipal } from "../lib/user-connection.js";

const tool = defineTool({
  description:
    "Search iCloud calendar events in a time range by keyword (matches " +
    "summary, description, location, uid). For Google Calendar use the " +
    "Google MCP search_events tool instead.",
  inputSchema: z.object({
    accountId: z.string().min(1),
    calendarUrl: z.string().url(),
    start: z.string().min(1),
    end: z.string().min(1),
    query: z.string().min(1).describe("Case-insensitive keyword"),
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
      const events = await searchEventsForAccount({
        userId: principal.principalId,
        accountId: input.accountId,
        calendarUrl: input.calendarUrl,
        start: input.start,
        end: input.end,
        query: input.query,
      });
      return {
        status: "ok",
        events: events.map(publicEventFields),
      };
    } catch (cause) {
      if (
        cause instanceof IcloudCalDavError ||
        cause instanceof SecretCryptoError
      ) {
        return { status: "error", error: cause.message };
      }
      return { status: "error", error: "Could not search iCloud events." };
    }
  },
});

export default defineDynamic(() => (toolSurfaceEnabled() ? tool : null));

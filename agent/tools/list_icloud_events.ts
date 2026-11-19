import { defineDynamic, defineTool } from "eve/tools";
import { z } from "zod";

import {
  listEventsForAccount,
  publicEventFields,
} from "@/lib/calendar/icloud-accounts";
import { IcloudCalDavError } from "@/lib/calendar/icloud-caldav";
import { SecretCryptoError } from "@/lib/crypto/secrets";
import { gatedToolExport } from "../lib/gated-tool.js";
import { isBetterAuthUserPrincipal } from "../lib/user-connection.js";

const tool = defineTool({
  description:
    "List events on an iCloud calendar in a time range (ISO-8601 start/end). " +
    "Use list_icloud_calendars to get calendarUrl. For Google Calendar use " +
    "the Google MCP list_events tool instead.",
  inputSchema: z.object({
    accountId: z.string().min(1),
    calendarUrl: z.string().url(),
    start: z
      .string()
      .min(1)
      .describe("Inclusive range start as ISO-8601 datetime"),
    end: z.string().min(1).describe("Exclusive range end as ISO-8601 datetime"),
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
      const events = await listEventsForAccount({
        userId: principal.principalId,
        accountId: input.accountId,
        calendarUrl: input.calendarUrl,
        start: input.start,
        end: input.end,
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
      return { status: "error", error: "Could not list iCloud events." };
    }
  },
});

export default defineDynamic(gatedToolExport("icloud", tool));

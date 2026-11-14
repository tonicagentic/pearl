import { defineDynamic, defineTool } from "eve/tools";
import { z } from "zod";

import { listCalendarsForAccount } from "@/lib/calendar/icloud-accounts";
import { IcloudCalDavError } from "@/lib/calendar/icloud-caldav";
import { SecretCryptoError } from "@/lib/crypto/secrets";
import { toolSurfaceEnabled } from "../lib/lane-state.js";
import { isBetterAuthUserPrincipal } from "../lib/user-connection.js";

const tool = defineTool({
  description:
    "List calendars on a linked iCloud Calendar account. Call " +
    "list_icloud_calendar_accounts first to get accountId. For Google " +
    "Calendar use the Google MCP list_calendars tool instead.",
  inputSchema: z.object({
    accountId: z
      .string()
      .min(1)
      .describe("iCloud calendar account id from list_icloud_calendar_accounts"),
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
      const calendars = await listCalendarsForAccount(
        principal.principalId,
        input.accountId,
      );
      return {
        status: "ok",
        calendars: calendars.map((calendar) => ({
          url: calendar.url,
          displayName: calendar.displayName,
          description: calendar.description,
        })),
      };
    } catch (cause) {
      if (
        cause instanceof IcloudCalDavError ||
        cause instanceof SecretCryptoError
      ) {
        return { status: "error", error: cause.message };
      }
      return {
        status: "error",
        error: "Could not list iCloud calendars.",
      };
    }
  },
});

export default defineDynamic(() => (toolSurfaceEnabled() ? tool : null));

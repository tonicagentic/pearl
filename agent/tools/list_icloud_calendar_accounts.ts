import { defineDynamic, defineTool } from "eve/tools";
import { z } from "zod";

import { listIcloudCalendarAccountSummaries } from "@/lib/calendar/icloud-accounts";
import { gatedToolExport } from "../lib/gated-tool.js";
import { isBetterAuthUserPrincipal } from "../lib/user-connection.js";

const tool = defineTool({
  description:
    "List the user's linked iCloud Calendar accounts (id, Apple ID, nickname). " +
    "Use these accountId values with list_icloud_calendars, list_icloud_events, " +
    "search_icloud_events, and get_icloud_event. For Google Calendar, use the " +
    "Google Calendar MCP tools instead (list_calendars, list_events, …).",
  inputSchema: z.object({}),
  async execute(_input, ctx) {
    const principal = ctx.session.auth.current;
    if (!isBetterAuthUserPrincipal(principal) || !principal?.principalId) {
      return {
        status: "error",
        error:
          "Sign in with a personal account and connect iCloud Calendar in Settings → Calendar.",
      };
    }
    const accounts = await listIcloudCalendarAccountSummaries(
      principal.principalId,
    );
    return {
      status: "ok",
      accounts: accounts.map((account) => ({
        accountId: account.id,
        appleId: account.appleId,
        nickname: account.nickname,
        status: account.status,
        detail: account.detail,
      })),
    };
  },
});

export default defineDynamic(gatedToolExport("icloud", tool));

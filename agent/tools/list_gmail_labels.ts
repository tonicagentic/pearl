import { defineDynamic, defineTool } from "eve/tools";
import { z } from "zod";

import { listGmailLabels } from "@/lib/agent/gmail-api";
import { toolSurfaceEnabled } from "#lib/lane-state.js";
import { resolveGmailToken } from "../lib/gmail-tool-helpers.js";

const tool = defineTool({
  description:
    "List Gmail labels for a connected mailbox (system and user labels). " +
    "Pass accountId when multiple mailboxes are connected.",
  inputSchema: z.object({
    accountId: z.string().nullish(),
  }),
  async execute(input, ctx) {
    const auth = await resolveGmailToken(
      ctx.session.auth.current,
      input.accountId,
    );
    if (!auth.ok) return { status: "error", error: auth.error };
    try {
      const labels = await listGmailLabels(auth.token);
      return {
        status: "ok",
        accountId: input.accountId ?? null,
        email: auth.emailLabel,
        labels,
      };
    } catch (cause) {
      return {
        status: "error",
        error: cause instanceof Error ? cause.message : "List labels failed.",
      };
    }
  },
});

export default defineDynamic(() => (toolSurfaceEnabled() ? tool : null));

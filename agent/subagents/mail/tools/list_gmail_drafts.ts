import { defineDynamic, defineTool } from "eve/tools";
import { z } from "zod";

import { listGmailDrafts } from "@/lib/agent/gmail-api";
import { gatedToolExport } from "../../../lib/gated-tool.js";
import { resolveGmailToken } from "../../../lib/gmail-tool-helpers.js";

const tool = defineTool({
  description:
    "List Gmail drafts in a connected mailbox. Pass accountId when multiple " +
    "mailboxes are connected.",
  inputSchema: z.object({
    accountId: z.string().nullish(),
    pageSize: z.number().int().min(1).max(50).nullish(),
  }),
  async execute(input, ctx) {
    const auth = await resolveGmailToken(
      ctx.session.auth.current,
      input.accountId,
    );
    if (!auth.ok) return { status: "error", error: auth.error };
    try {
      const drafts = await listGmailDrafts(auth.token, input.pageSize ?? 20);
      return {
        status: "ok",
        accountId: input.accountId ?? null,
        email: auth.emailLabel,
        drafts,
      };
    } catch (cause) {
      return {
        status: "error",
        error: cause instanceof Error ? cause.message : "List drafts failed.",
      };
    }
  },
});

export default defineDynamic(gatedToolExport("gmail", tool));

import { defineDynamic, defineTool } from "eve/tools";
import { z } from "zod";

import { searchGmailThreads } from "@/lib/agent/gmail-api";
import { gatedToolExport } from "#lib/gated-tool.js";
import { resolveGmailToken } from "../lib/gmail-tool-helpers.js";

const tool = defineTool({
  description:
    "Search Gmail threads in a connected mailbox with Gmail query syntax " +
    "(for example is:unread, from:alice@example.com). Returns metadata and " +
    "snippets — use get_gmail_thread for full bodies. Pass accountId when " +
    "more than one mailbox is connected.",
  inputSchema: z.object({
    accountId: z.string().nullish(),
    query: z.string().nullish(),
    pageSize: z.number().int().min(1).max(50).nullish(),
    pageToken: z.string().nullish(),
  }),
  async execute(input, ctx) {
    const auth = await resolveGmailToken(
      ctx.session.auth.current,
      input.accountId,
    );
    if (!auth.ok) return { status: "error", error: auth.error };
    try {
      const result = await searchGmailThreads(auth.token, {
        query: input.query ?? undefined,
        pageSize: input.pageSize ?? undefined,
        pageToken: input.pageToken ?? undefined,
      });
      return {
        status: "ok",
        accountId: input.accountId ?? null,
        email: auth.emailLabel,
        ...result,
      };
    } catch (cause) {
      return {
        status: "error",
        error: cause instanceof Error ? cause.message : "Search failed.",
      };
    }
  },
});

export default defineDynamic(gatedToolExport("gmail", tool));

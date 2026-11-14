import { defineDynamic, defineTool } from "eve/tools";
import { z } from "zod";

import { getGmailThread } from "@/lib/agent/gmail-api";
import { toolSurfaceEnabled } from "#lib/lane-state.js";
import { resolveGmailToken } from "../lib/gmail-tool-helpers.js";

const tool = defineTool({
  description:
    "Read one Gmail thread by id. Default format is full (includes plain-text " +
    "bodies, capped). Use metadata when you only need headers. Pass accountId " +
    "when multiple mailboxes are connected.",
  inputSchema: z.object({
    accountId: z.string().nullish(),
    threadId: z.string().min(1),
    format: z.enum(["full", "metadata"]).nullish(),
  }),
  async execute(input, ctx) {
    const auth = await resolveGmailToken(
      ctx.session.auth.current,
      input.accountId,
    );
    if (!auth.ok) return { status: "error", error: auth.error };
    try {
      const thread = await getGmailThread(
        auth.token,
        input.threadId,
        input.format ?? "full",
      );
      return {
        status: "ok",
        accountId: input.accountId ?? null,
        email: auth.emailLabel,
        thread,
      };
    } catch (cause) {
      return {
        status: "error",
        error: cause instanceof Error ? cause.message : "Get thread failed.",
      };
    }
  },
});

export default defineDynamic(() => (toolSurfaceEnabled() ? tool : null));

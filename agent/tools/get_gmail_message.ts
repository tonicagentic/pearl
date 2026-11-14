import { defineDynamic, defineTool } from "eve/tools";
import { z } from "zod";

import { getGmailMessage } from "@/lib/agent/gmail-api";
import { toolSurfaceEnabled } from "#lib/lane-state.js";
import { resolveGmailToken } from "../lib/gmail-tool-helpers.js";

const tool = defineTool({
  description:
    "Read one Gmail message by id, including a capped plain-text body. " +
    "Prefer get_gmail_thread for conversation context. Pass accountId when " +
    "multiple mailboxes are connected.",
  inputSchema: z.object({
    accountId: z.string().nullish(),
    messageId: z.string().min(1),
  }),
  async execute(input, ctx) {
    const auth = await resolveGmailToken(
      ctx.session.auth.current,
      input.accountId,
    );
    if (!auth.ok) return { status: "error", error: auth.error };
    try {
      const message = await getGmailMessage(auth.token, input.messageId);
      return {
        status: "ok",
        accountId: input.accountId ?? null,
        email: auth.emailLabel,
        message,
      };
    } catch (cause) {
      return {
        status: "error",
        error: cause instanceof Error ? cause.message : "Get message failed.",
      };
    }
  },
});

export default defineDynamic(() => (toolSurfaceEnabled() ? tool : null));

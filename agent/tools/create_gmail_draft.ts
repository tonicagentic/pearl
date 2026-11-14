import { defineDynamic, defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";

import { createGmailDraft } from "@/lib/agent/gmail-api";
import { toolSurfaceEnabled } from "#lib/lane-state.js";
import { isPlanMode, planModeBlocked } from "#lib/turn-context.js";
import { resolveGmailToken } from "../lib/gmail-tool-helpers.js";

const tool = defineTool({
  description:
    "Create a Gmail draft in a connected mailbox. Needs approval. Does not " +
    "send — use send_gmail_message after the user confirms. Pass accountId " +
    "when multiple mailboxes are connected.",
  inputSchema: z.object({
    accountId: z.string().nullish(),
    to: z.string().min(1),
    cc: z.string().nullish(),
    bcc: z.string().nullish(),
    subject: z.string().min(1).max(998),
    body: z.string().min(1),
    threadId: z.string().nullish(),
    inReplyTo: z.string().nullish(),
  }),
  approval: {
    request: always(),
    prompt: ({ input }) =>
      `Create this Gmail draft${input.accountId ? ` in mailbox ${input.accountId}` : ""}?\nTo: ${input.to}` +
      (input.cc ? `\nCc: ${input.cc}` : "") +
      `\nSubject: ${input.subject}\n\n${input.body}`,
  },
  async execute(input, ctx) {
    if (isPlanMode()) return planModeBlocked("create_gmail_draft");
    const auth = await resolveGmailToken(
      ctx.session.auth.current,
      input.accountId,
    );
    if (!auth.ok) return { status: "error", error: auth.error };
    try {
      const draft = await createGmailDraft(auth.token, input);
      return {
        status: "ok",
        accountId: input.accountId ?? null,
        email: auth.emailLabel,
        draft,
      };
    } catch (cause) {
      return {
        status: "error",
        error: cause instanceof Error ? cause.message : "Create draft failed.",
      };
    }
  },
});

export default defineDynamic(() => (toolSurfaceEnabled() ? tool : null));

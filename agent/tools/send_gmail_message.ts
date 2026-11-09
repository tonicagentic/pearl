import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";

import {
  AmbiguousSendError,
  executeGmailSend,
} from "../../lib/agent/gmail-send";
import { getGmailUserToken } from "@/lib/connections/tokens";
import { isBetterAuthUserPrincipal } from "../lib/user-connection.js";
import { isPlanMode, planModeBlocked } from "#lib/turn-context.js";

// Destructive reference tool: sends real email from the signed-in user's
// Gmail. Gmail's MCP server cannot send, so this calls the Gmail REST API with
// the user's Vercel Connect token (the token stays in the app runtime).
//
//   - `approval` parks the run until a person approves; the card shows the
//     recipients, subject, and the full body so the approval is informed.
//   - The execution ledger makes replays of the same logical send a no-op and
//     surfaces a crash mid-send as `incomplete` (lib/agent/gmail-send.ts).
//   - Plan mode refuses before anything happens.
//
// Needs the gmail.compose scope. Users who connected Gmail read-only must
// re-authorize once in Settings; a missing scope surfaces as a send error.

const GMAIL_SEND_URL =
  "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";

const inputSchema = z.object({
  to: z
    .string()
    .min(1)
    .describe("Recipient address, or several separated by commas."),
  cc: z.string().nullish().describe("Optional Cc addresses, comma-separated."),
  bcc: z.string().nullish().describe("Optional Bcc addresses, comma-separated."),
  subject: z.string().min(1).max(998),
  body: z.string().min(1).describe("Plain-text email body."),
  threadId: z
    .string()
    .nullish()
    .describe("Gmail thread id when replying inside an existing thread."),
  inReplyTo: z
    .string()
    .nullish()
    .describe("Message-ID header of the message being replied to."),
  idempotencyKey: z
    .string()
    .nullish()
    .describe("Optional stable key; retries with the same key never double-send."),
});

export default defineTool({
  description:
    "Send an email from the signed-in user's Gmail. Irreversible and needs the user's approval every time. " +
    "Create a draft first and send only after the user explicitly confirms the exact recipient, subject, and body. " +
    "Never send in bulk from one confirmation.",
  inputSchema,
  approval: {
    request: always(),
    prompt: ({ input }) =>
      `Send this email?\nTo: ${input.to}` +
      (input.cc ? `\nCc: ${input.cc}` : "") +
      (input.bcc ? `\nBcc: ${input.bcc}` : "") +
      `\nSubject: ${input.subject}\n\n${input.body}`,
  },
  async execute(input, ctx) {
    if (isPlanMode()) {
      return planModeBlocked("send_gmail_message");
    }

    const principal = ctx.session.auth.current;
    if (!isBetterAuthUserPrincipal(principal) || !principal?.principalId) {
      return {
        status: "error",
        error:
          "Sign in with a personal account and connect Gmail in Settings to send email.",
      };
    }

    let token: string;
    try {
      token = await getGmailUserToken(principal.principalId);
    } catch (cause) {
      return {
        status: "error",
        error:
          cause instanceof Error
            ? `${cause.message} If Gmail was connected before sending was added, reconnect it in Settings to grant compose access.`
            : "Gmail token unavailable.",
      };
    }

    return executeGmailSend(principal.principalId, input, {
      send: async (raw, threadId) => {
        let res: Response;
        try {
          res = await fetch(GMAIL_SEND_URL, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(threadId ? { raw, threadId } : { raw }),
            signal: AbortSignal.timeout(15_000),
          });
        } catch (cause) {
          throw new AmbiguousSendError(
            cause instanceof Error ? cause.message : "Gmail request failed.",
          );
        }
        if (!res.ok) {
          const detail = (await res.text()).slice(0, 400);
          if (res.status >= 500) {
            throw new AmbiguousSendError(
              `Gmail send responded ${res.status}: ${detail}`,
            );
          }
          throw new Error(
            `Gmail send responded ${res.status}${
              res.status === 403
                ? " (the grant likely lacks gmail.compose — reconnect Gmail in Settings)"
                : ""
            }: ${detail}`,
          );
        }
        const data = (await res.json()) as { id?: string };
        return data.id ?? "sent";
      },
    });
  },
});

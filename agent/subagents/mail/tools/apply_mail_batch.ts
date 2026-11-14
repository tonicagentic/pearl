import { defineDynamic, defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";

import { toolSurfaceEnabled } from "../../../lib/lane-state.js";
import { isPlanMode, planModeBlocked } from "../../../lib/turn-context.js";
import { isBetterAuthUserPrincipal } from "../../../lib/user-connection.js";
import {
  executeMailBatch,
  summarizeBatchForApproval,
  type MailBatchItem,
} from "@/lib/agent/gmail-modify";

const actionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("archive") }),
  z.object({ type: z.literal("mark_read") }),
  z.object({
    type: z.literal("add_label"),
    labelId: z.string().min(1),
  }),
  z.object({
    type: z.literal("remove_label"),
    labelId: z.string().min(1),
  }),
]);

const itemSchema = z.object({
  accountId: z.string().min(1).describe("Mailbox id from list_mail_accounts."),
  threadId: z.string().min(1).describe("Gmail thread id."),
  action: actionSchema,
  subject: z.string().nullish(),
  from: z.string().nullish(),
});

const inputSchema = z.object({
  items: z
    .array(itemSchema)
    .min(1)
    .max(50)
    .describe("Threads to archive, mark read, or label."),
  fromSavedRule: z
    .boolean()
    .nullish()
    .describe(
      "True when applying threads that already matched a user-confirmed rule.",
    ),
});

const tool = defineTool({
  description:
    "Apply archive, mark-read, or label changes to Gmail threads across " +
    "connected accounts. Always needs approval unless the batch is only " +
    "threads that matched a saved rule (still show the card). Never trash " +
    "or spam. Cap at 50 threads per call.",
  inputSchema,
  approval: {
    request: always(),
    prompt: ({ input }) =>
      summarizeBatchForApproval(input.items as MailBatchItem[]),
  },
  async execute(input, ctx) {
    if (isPlanMode()) {
      return planModeBlocked("apply_mail_batch");
    }
    const principal = ctx.session.auth.current;
    if (!isBetterAuthUserPrincipal(principal) || !principal?.principalId) {
      return {
        status: "error",
        error: "Sign in with a personal account and connect Gmail in Settings.",
      };
    }

    const result = await executeMailBatch(
      principal.principalId,
      input.items as MailBatchItem[],
    );
    return {
      status: result.failed === 0 ? "ok" : "partial",
      applied: result.applied,
      failed: result.failed,
      fromSavedRule: input.fromSavedRule === true,
      results: result.results,
    };
  },
});

export default defineDynamic(() => (toolSurfaceEnabled() ? tool : null));

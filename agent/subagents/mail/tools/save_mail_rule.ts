import { defineDynamic, defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";

import { toolSurfaceEnabled } from "../../../lib/lane-state.js";
import { isPlanMode, planModeBlocked } from "../../../lib/turn-context.js";
import { isBetterAuthUserPrincipal } from "../../../lib/user-connection.js";
import { createMailRule } from "@/lib/mail/rules";
import { MAIL_RULE_ACTIONS } from "@/lib/db/schema";

const inputSchema = z.object({
  accountId: z
    .string()
    .nullish()
    .describe("Mailbox id, or omit to apply the rule on every account."),
  matchFrom: z.string().nullish().describe("Substring match on From."),
  matchList: z.string().nullish().describe("Substring match on List-Id."),
  matchSubject: z.string().nullish().describe("Substring match on Subject."),
  action: z.enum(MAIL_RULE_ACTIONS),
  labelId: z
    .string()
    .nullish()
    .describe("Gmail label id when action is label."),
  labelName: z.string().nullish().describe("Human label name for display."),
});

const tool = defineTool({
  description:
    "Save a triage rule the user confirmed (for example always archive " +
    "receipts from a sender). Later triage runs apply matching threads " +
    "without asking again. At least one of matchFrom, matchList, or " +
    "matchSubject is required.",
  inputSchema,
  approval: {
    request: always(),
    prompt: ({ input }) => {
      const matchers = [
        input.matchFrom ? `from contains "${input.matchFrom}"` : null,
        input.matchList ? `list contains "${input.matchList}"` : null,
        input.matchSubject
          ? `subject contains "${input.matchSubject}"`
          : null,
      ]
        .filter(Boolean)
        .join(", ");
      const scope = input.accountId
        ? `account ${input.accountId}`
        : "all accounts";
      const action =
        input.action === "label"
          ? `label ${input.labelName ?? input.labelId ?? "?"}`
          : input.action;
      return `Save mail rule on ${scope}: when ${matchers || "(missing matchers)"}, then ${action}?`;
    },
  },
  async execute(input, ctx) {
    if (isPlanMode()) {
      return planModeBlocked("save_mail_rule");
    }
    const principal = ctx.session.auth.current;
    if (!isBetterAuthUserPrincipal(principal) || !principal?.principalId) {
      return {
        status: "error",
        error: "Sign in with a personal account first.",
      };
    }
    if (!input.matchFrom && !input.matchList && !input.matchSubject) {
      return {
        status: "error",
        error: "Set at least one of matchFrom, matchList, or matchSubject.",
      };
    }
    try {
      const rule = await createMailRule(principal.principalId, {
        mailAccountId: input.accountId,
        matchFrom: input.matchFrom,
        matchList: input.matchList,
        matchSubject: input.matchSubject,
        action: input.action,
        labelId: input.labelId,
        labelName: input.labelName,
      });
      return { status: "ok", ruleId: rule.id };
    } catch (cause) {
      return {
        status: "error",
        error: cause instanceof Error ? cause.message : "Could not save rule.",
      };
    }
  },
});

export default defineDynamic(() => (toolSurfaceEnabled() ? tool : null));

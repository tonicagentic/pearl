import { defineDynamic, defineTool } from "eve/tools";
import { z } from "zod";

import { toolSurfaceEnabled } from "../../../lib/lane-state.js";
import { isBetterAuthUserPrincipal } from "../../../lib/user-connection.js";
import { listMailboxSummaries } from "@/lib/mail/accounts";
import { listMailRules } from "@/lib/mail/rules";

const tool = defineTool({
  description:
    "List the user's connected Gmail mailboxes (id, email, nickname, whether " +
    "archive/mark-read is allowed) and saved triage rules. Call this before " +
    "searching or applying batches so you use the correct accountId values.",
  inputSchema: z.object({}),
  async execute(_input, ctx) {
    const principal = ctx.session.auth.current;
    if (!isBetterAuthUserPrincipal(principal) || !principal?.principalId) {
      return {
        status: "error",
        error: "Sign in with a personal account and connect Gmail in Settings.",
      };
    }
    const [mailboxes, rules] = await Promise.all([
      listMailboxSummaries(principal.principalId),
      listMailRules(principal.principalId),
    ]);
    return {
      status: "ok",
      mailboxes: mailboxes.map((box) => ({
        accountId: box.id,
        email: box.emailLabel,
        nickname: box.nickname,
        status: box.status,
        canModify: box.canModify,
        detail: box.detail,
      })),
      rules: rules.map((rule) => ({
        id: rule.id,
        accountId: rule.mailAccountId,
        matchFrom: rule.matchFrom,
        matchList: rule.matchList,
        matchSubject: rule.matchSubject,
        action: rule.action,
        labelId: rule.labelId,
        labelName: rule.labelName,
      })),
    };
  },
});

export default defineDynamic(() => (toolSurfaceEnabled() ? tool : null));

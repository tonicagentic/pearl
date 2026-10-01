import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";
import { ensureUserForPrincipal, listOpenIssues, resolveIssue } from "@/lib/db/issues";

/**
 * Tool that settles an issue: the unresolved area is resolved.
 *
 * @remarks
 * Scoped to the framework-resolved principal (`ctx.session.auth.current`), never
 * to model input. Resolution is gated on human approval (mirroring delete_asset):
 * it is effectively irreversible from the active inbox and the model must never
 * settle something on a third-party claim alone.
 */
export default defineTool({
  description:
    "Mark one of the user's issues as resolved — the area is settled. Confirm with " +
    "the user first when the resolution was only implied (for example by a third party or an " +
    "assumption). Find the id with list_issues.",
  /**
   * Resolve one issue by id.
   *
   * @param input - The issue id.
   * @param ctx - Tool runtime context; supplies the resolved principal.
   */
  async execute(input, ctx) {
    const principal = ctx.session.auth.current;
    const userId =
      principal?.principalType === "user" ? principal.principalId : null;

    if (!principal || !userId) {
      return { error: "No signed-in user to resolve an issue for." };
    }

    await ensureUserForPrincipal(principal);

    const open = await listOpenIssues(userId);
    const issue = open.find((row) => row.id === input.issueId);

    if (!issue) {
      return {
        error: "No open issue with that id. List issues first and use its id.",
      };
    }

    await resolveIssue(userId, input.issueId);

    return {
      resolved: issue.title,
      area: issue.areaName,
    };
  },
  approval: always(),
  inputSchema: z.object({
    issueId: z.string(),
  }),
  outputSchema: z.object({
    error: z.string().optional(),
    resolved: z.string().optional(),
    area: z.string().optional(),
  }),
});

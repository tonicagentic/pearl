import { defineTool } from "eve/tools";
import { z } from "zod";

import { getProject, listPlans } from "@/lib/db/projects";

import { requirePrincipalUser } from "#lib/principal.js";
import { turnClientIntent } from "#lib/turn-context.js";

/**
 * List plan documents in a project the signed-in user owns.
 */
export default defineTool({
  description:
    "List the plans in a project (title, slug, id, updatedAt). Defaults to the " +
    "active project from this turn's context when projectId is omitted.",
  async execute(input, ctx) {
    const auth = await requirePrincipalUser(ctx.session.auth.current);
    if ("error" in auth) {
      return { error: "No signed-in user to list plans for." };
    }
    const { userId } = auth;

    const projectId =
      input.projectId?.trim() || turnClientIntent.get().projectId;
    if (!projectId) {
      return {
        error:
          "No project given. Attach the chat to a project or pass projectId.",
      };
    }

    const owned = await getProject(userId, projectId);
    if (!owned) {
      return { error: "Unknown project id." };
    }

    const plans = await listPlans(userId, projectId);
    return {
      projectId,
      projectName: owned.name,
      plans: plans.map((row) => ({
        id: row.id,
        title: row.title,
        slug: row.slug,
        updatedAt: row.updatedAt.toISOString(),
      })),
    };
  },
  inputSchema: z.object({
    projectId: z.string().optional(),
  }),
  outputSchema: z.object({
    error: z.string().optional(),
    projectId: z.string().optional(),
    projectName: z.string().optional(),
    plans: z
      .array(
        z.object({
          id: z.string(),
          title: z.string(),
          slug: z.string(),
          updatedAt: z.string(),
        }),
      )
      .optional(),
  }),
});

import { defineTool } from "eve/tools";
import { z } from "zod";

import { savePlan } from "@/lib/db/projects";

import { requirePrincipalUser } from "#lib/principal.js";
import { turnClientIntent } from "#lib/turn-context.js";

/**
 * Create or replace a plan document in a project. The one write allowed in
 * Plan mode; the project page editor is the review surface (no approval card).
 */
export default defineTool({
  description:
    "Create or replace a markdown plan in a project. Pass title and markdown; " +
    "optional slug (derived from the title when omitted) and planId to update " +
    "an existing row. Defaults to the active project. Read the plan first when " +
    "updating so you keep the user's edits.",
  async execute(input, ctx) {
    const auth = await requirePrincipalUser(ctx.session.auth.current);
    if ("error" in auth) {
      return { error: "No signed-in user to save a plan for." };
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

    try {
      const row = await savePlan(userId, {
        projectId,
        title: input.title,
        slug: input.slug,
        markdown: input.markdown,
        planId: input.planId,
      });
      return {
        id: row.id,
        projectId: row.projectId,
        title: row.title,
        slug: row.slug,
      };
    } catch (error) {
      return {
        error:
          error instanceof Error ? error.message : "Could not save the plan.",
      };
    }
  },
  inputSchema: z.object({
    title: z.string().max(200),
    markdown: z.string().max(200_000),
    slug: z.string().max(80).optional(),
    projectId: z.string().optional(),
    planId: z.string().optional(),
  }),
  outputSchema: z.object({
    error: z.string().optional(),
    id: z.string().optional(),
    projectId: z.string().optional(),
    title: z.string().optional(),
    slug: z.string().optional(),
  }),
});

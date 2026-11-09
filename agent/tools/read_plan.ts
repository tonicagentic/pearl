import { defineTool } from "eve/tools";
import { z } from "zod";

import { getPlan, getPlanBySlug, getProject } from "@/lib/db/projects";

import { requirePrincipalUser } from "#lib/principal.js";
import { turnClientIntent } from "#lib/turn-context.js";

/**
 * Read one plan document by id or by project + slug.
 */
export default defineTool({
  description:
    "Read a plan's markdown by plan id, or by slug within a project. Defaults to " +
    "the active project when only slug is given. Call this before replacing a " +
    "plan body so user edits are not overwritten.",
  async execute(input, ctx) {
    const auth = await requirePrincipalUser(ctx.session.auth.current);
    if ("error" in auth) {
      return { error: "No signed-in user to read a plan for." };
    }
    const { userId } = auth;

    if (input.planId) {
      const row = await getPlan(userId, input.planId);
      if (!row) return { error: "Unknown plan id." };
      return {
        id: row.id,
        projectId: row.projectId,
        title: row.title,
        slug: row.slug,
        markdown: row.markdown,
      };
    }

    const projectId =
      input.projectId?.trim() || turnClientIntent.get().projectId;
    const slug = input.slug?.trim();
    if (!projectId || !slug) {
      return {
        error: "Pass planId, or both projectId (or an active project) and slug.",
      };
    }

    const owned = await getProject(userId, projectId);
    if (!owned) return { error: "Unknown project id." };

    const row = await getPlanBySlug(userId, projectId, slug);
    if (!row) return { error: "No plan with that slug in this project." };

    return {
      id: row.id,
      projectId: row.projectId,
      title: row.title,
      slug: row.slug,
      markdown: row.markdown,
    };
  },
  inputSchema: z.object({
    planId: z.string().optional(),
    projectId: z.string().optional(),
    slug: z.string().optional(),
  }),
  outputSchema: z.object({
    error: z.string().optional(),
    id: z.string().optional(),
    projectId: z.string().optional(),
    title: z.string().optional(),
    slug: z.string().optional(),
    markdown: z.string().optional(),
  }),
});

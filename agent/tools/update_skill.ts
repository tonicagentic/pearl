import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";
import { updateSkillForPrincipal } from "#lib/user-skills.js";

/**
 * Update one of the signed-in user's skills.
 *
 * @remarks
 * Gated with always(): every update parks a tool-approval card. Call get_skill
 * first, then pass the merged fields. Scoped to `ctx.session.auth.current`.
 */
export default defineTool({
  approval: always(),
  description:
    "Update one of this user's skills by slug. Requires approval every time. " +
    "Load with get_skill first, then pass the fields to change. Optional newSlug " +
    "renames the skill. Cannot take a built-in skill name.",
  async execute(input, ctx) {
    try {
      const row = await updateSkillForPrincipal(ctx.session.auth.current, input);
      return {
        success: true as const,
        slug: row.slug,
        title: row.title,
        enabled: row.enabled,
      };
    } catch (error) {
      return {
        success: false as const,
        error:
          error instanceof Error ? error.message : "Could not update skill.",
      };
    }
  },
  inputSchema: z.object({
    slug: z.string().describe("Current slug of the skill to update."),
    title: z.string().optional().describe("New title."),
    description: z.string().optional().describe("New routing description."),
    markdown: z.string().optional().describe("New skill body."),
    enabled: z.boolean().optional().describe("Enable or disable the skill."),
    newSlug: z
      .string()
      .optional()
      .describe("Optional new slug if renaming the skill."),
  }),
});

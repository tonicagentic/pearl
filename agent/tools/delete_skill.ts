import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";
import { deleteSkillForPrincipal } from "#lib/user-skills.js";

/**
 * Delete one of the signed-in user's skills.
 *
 * @remarks
 * Gated with always(): every delete parks a tool-approval card. Scoped to
 * `ctx.session.auth.current`. Built-in filesystem skills cannot be deleted.
 */
export default defineTool({
  approval: always(),
  description:
    "Permanently delete one of this user's skills by slug. Requires approval " +
    "every time. Built-in skills cannot be deleted.",
  async execute({ slug }, ctx) {
    try {
      const result = await deleteSkillForPrincipal(
        ctx.session.auth.current,
        slug,
      );
      return { success: true as const, ...result };
    } catch (error) {
      return {
        success: false as const,
        error:
          error instanceof Error ? error.message : "Could not delete skill.",
      };
    }
  },
  inputSchema: z.object({
    slug: z.string().describe("Slug of the skill to delete."),
  }),
});

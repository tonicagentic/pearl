import { defineTool } from "eve/tools";
import { z } from "zod";
import { getSkillForPrincipal } from "#lib/user-skills.js";

/**
 * Read one of the signed-in user's skills by slug.
 *
 * @remarks
 * Read-only. Returns the markdown body and sibling file paths so the model can
 * edit carefully after approval-gated create/update tools.
 */
export default defineTool({
  description:
    "Get one of this user's skills by slug, including the full markdown body " +
    "and sibling file paths. Use before update_skill.",
  async execute({ slug }, ctx) {
    try {
      const row = await getSkillForPrincipal(ctx.session.auth.current, slug);
      if (!row) {
        return {
          success: false as const,
          error: `No skill named "${slug}".`,
        };
      }
      return {
        success: true as const,
        skill: {
          slug: row.slug,
          title: row.title,
          description: row.description,
          markdown: row.markdown,
          enabled: row.enabled,
          source: row.source,
          registryName: row.registryName,
          files: Object.keys(row.files ?? {}).sort(),
        },
      };
    } catch (error) {
      return {
        success: false as const,
        error: error instanceof Error ? error.message : "Could not get skill.",
      };
    }
  },
  inputSchema: z.object({
    slug: z.string().describe("The skill slug to load."),
  }),
});

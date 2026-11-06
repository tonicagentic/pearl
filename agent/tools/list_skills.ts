import { defineTool } from "eve/tools";
import { z } from "zod";
import { listSkillsForPrincipal } from "#lib/user-skills.js";

/**
 * List the signed-in user's custom and installed skills.
 *
 * @remarks
 * Read-only. Scoped to `ctx.session.auth.current`. Use before proposing
 * create/update/delete so the model knows what already exists.
 */
export default defineTool({
  description:
    "List this user's skills (slug, title, description, enabled, source). " +
    "Does not include built-in filesystem skills. Use get_skill for the full body.",
  async execute(_input, ctx) {
    try {
      const rows = await listSkillsForPrincipal(ctx.session.auth.current);
      return {
        success: true as const,
        skills: rows.map((row) => ({
          slug: row.slug,
          title: row.title,
          description: row.description,
          enabled: row.enabled,
          source: row.source,
          registryName: row.registryName,
          fileCount: Object.keys(row.files ?? {}).length,
        })),
      };
    } catch (error) {
      return {
        success: false as const,
        error: error instanceof Error ? error.message : "Could not list skills.",
      };
    }
  },
  inputSchema: z.object({}),
});

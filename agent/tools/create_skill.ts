import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";
import { createSkillForPrincipal } from "#lib/user-skills.js";
import { isPlanMode, planModeBlocked } from "#lib/turn-context.js";

/**
 * Create a custom skill for the signed-in user.
 *
 * @remarks
 * Gated with always(): every create parks a tool-approval card showing the
 * proposed skill. Scoped to `ctx.session.auth.current`. Cannot override
 * built-in filesystem skill names.
 */
export default defineTool({
  approval: always(),
  description:
    "Create a custom skill for this user (slug, title, description, markdown). " +
    "Requires approval every time. The description is the routing hint; the " +
    "markdown loads only when the skill is activated. Cannot reuse a built-in skill name.",
  async execute(input, ctx) {
    if (isPlanMode()) {
      return { success: false as const, ...planModeBlocked("create_skill") };
    }
    try {
      const row = await createSkillForPrincipal(ctx.session.auth.current, input);
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
          error instanceof Error ? error.message : "Could not create skill.",
      };
    }
  },
  inputSchema: z.object({
    slug: z
      .string()
      .describe(
        "Shell-safe skill id: starts with a letter or digit; letters, digits, '.', '_', '-' only.",
      ),
    title: z.string().describe("Short human title for the skill."),
    description: z
      .string()
      .describe(
        "Routing hint Pearl sees every turn. Write the task that should activate this skill.",
      ),
    markdown: z
      .string()
      .describe("The skill body (SKILL.md content) loaded on activation."),
    enabled: z
      .boolean()
      .optional()
      .describe("Whether the skill is available immediately. Defaults to true."),
  }),
});

import { defineTool } from "eve/tools";
import { z } from "zod";
import { getProfileForPrincipal } from "#lib/user-profile.js";

/**
 * Read the signed-in user's structured identity profile.
 *
 * @remarks
 * Call when clothing fit, sizing, health advice, home context, or other
 * identity details matter — not every turn. Scoped to
 * `ctx.session.auth.current`. Empty / missing profile returns `found: false`.
 */
export default defineTool({
  description:
    "Load this user's structured profile (name, birthdate/age, nationality, " +
    "physical features, clothing sizes, health notes, home, and plan " +
    "preferences such as travel and planning horizon). Call when fit, " +
    "sizing, shopping, travel, planning, health, or home context matters. " +
    "Returns found:false when nothing is saved yet.",
  async execute(_input, ctx) {
    try {
      const result = await getProfileForPrincipal(ctx.session.auth.current);
      return {
        success: true as const,
        ...result,
      };
    } catch (error) {
      return {
        success: false as const,
        error:
          error instanceof Error ? error.message : "Could not load profile.",
      };
    }
  },
  inputSchema: z.object({}),
});

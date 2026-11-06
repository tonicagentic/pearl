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
    "Load this user's structured identity profile (name, birthdate/age, " +
    "nationality, physical features, health notes, home). Call when fit, " +
    "sizing, health advice, or personal/home context matters — not on every " +
    "turn. Returns found:false when nothing is saved yet.",
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

import { defineTool } from "eve/tools";
import { once } from "eve/tools/approval";
import { z } from "zod";
import { archiveCapabilityForPrincipal } from "#lib/capabilities.js";
import { isPlanMode, planModeBlocked } from "#lib/turn-context.js";

/**
 * Archive a capability so it leaves the active catalog.
 *
 * @remarks
 * Gated with once(). Idempotent when already archived. Scoped to
 * `ctx.session.auth.current`.
 */
export default defineTool({
  approval: once(),
  description:
    "Archive a capability by id so it no longer appears in the active " +
    "catalog. Tell the user when you archive one. Prefer archive over " +
    "deleting history.",
  async execute(input, ctx) {
    if (isPlanMode()) {
      return {
        success: false as const,
        ...planModeBlocked("archive_capability"),
      };
    }
    try {
      const capability = await archiveCapabilityForPrincipal(
        ctx.session.auth.current,
        input.id,
      );
      return {
        success: true as const,
        capability,
      };
    } catch (error) {
      return {
        success: false as const,
        error:
          error instanceof Error
            ? error.message
            : "Could not archive capability.",
      };
    }
  },
  inputSchema: z.object({
    id: z.string().describe("Capability id from list_capabilities."),
  }),
});

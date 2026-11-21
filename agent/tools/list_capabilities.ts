import { defineTool } from "eve/tools";
import { z } from "zod";
import { listCapabilitiesForPrincipal } from "#lib/capabilities.js";

/**
 * List the signed-in user's marketable capabilities.
 *
 * @remarks
 * Read-only. Defaults to active and exploring (excludes archived). Scoped to
 * `ctx.session.auth.current`.
 */
export default defineTool({
  description:
    "List this user's capabilities — marketable skills, products, or services " +
    "they can sell. Defaults to active and exploring; pass status or kind to " +
    "filter. Use before career, offer, or market-discovery work. Does not " +
    "include agent playbooks (those are skills).",
  async execute(input, ctx) {
    try {
      const statuses =
        input.status !== undefined
          ? ([input.status] as const)
          : undefined;
      const capabilities = await listCapabilitiesForPrincipal(
        ctx.session.auth.current,
        {
          kind: input.kind,
          statuses,
        },
      );
      return {
        success: true as const,
        capabilities,
      };
    } catch (error) {
      return {
        success: false as const,
        error:
          error instanceof Error
            ? error.message
            : "Could not list capabilities.",
      };
    }
  },
  inputSchema: z.object({
    kind: z
      .enum(["skill", "product", "service"])
      .optional()
      .describe("Only return this kind."),
    status: z
      .enum(["active", "exploring", "archived"])
      .optional()
      .describe(
        "Only return this status. When omitted, returns active and exploring.",
      ),
  }),
});

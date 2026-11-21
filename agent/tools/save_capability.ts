import { defineTool } from "eve/tools";
import { once } from "eve/tools/approval";
import { z } from "zod";
import { saveCapabilityForPrincipal } from "#lib/capabilities.js";
import { isPlanMode, planModeBlocked } from "#lib/turn-context.js";
import { CapabilityInputError } from "@/lib/capabilities/validation";

/**
 * Create or update a marketable capability for the signed-in user.
 *
 * @remarks
 * Gated with once(): first save in a turn needs approval. Matching name
 * (case-insensitive) updates the existing row. Scoped to
 * `ctx.session.auth.current`.
 */
export default defineTool({
  approval: once(),
  description:
    "Save a capability — something the user can sell as a skill, product, or " +
    "service. Pass id to update a known row; otherwise matching name " +
    "(case-insensitive) updates the existing capability. Tell the user when " +
    "you save or change one. Never invent proof. Not for hobbies, tasks, or " +
    "agent playbooks.",
  async execute(input, ctx) {
    if (isPlanMode()) {
      return { success: false as const, ...planModeBlocked("save_capability") };
    }
    try {
      const result = await saveCapabilityForPrincipal(
        ctx.session.auth.current,
        {
          id: input.id,
          name: input.name,
          kind: input.kind,
          summary: input.summary,
          audience: input.audience,
          proof: input.proof,
          status: input.status,
          projectId: input.projectId,
          notes: input.notes,
        },
      );
      return {
        success: true as const,
        created: result.created,
        capability: result.capability,
      };
    } catch (error) {
      return {
        success: false as const,
        error:
          error instanceof CapabilityInputError || error instanceof Error
            ? error.message
            : "Could not save capability.",
      };
    }
  },
  inputSchema: z.object({
    id: z
      .string()
      .optional()
      .describe("Existing capability id when updating a known row."),
    name: z
      .string()
      .describe("The user's words for what they sell or can sell."),
    kind: z
      .enum(["skill", "product", "service"])
      .describe("Whether this is a marketable skill, a product, or a service."),
    summary: z
      .string()
      .describe("One line on what the buyer gets."),
    audience: z
      .string()
      .optional()
      .describe("Who it is for, in the user's words."),
    proof: z
      .string()
      .optional()
      .describe(
        "Real credentials, customers, or results the user gave. Leave blank when none.",
      ),
    status: z
      .enum(["active", "exploring", "archived"])
      .optional()
      .describe("Defaults to active. Use exploring while still shaping it."),
    projectId: z
      .string()
      .optional()
      .describe("Optional work project to attach. Career skills leave this empty."),
    notes: z.string().optional().describe("Optional free-form notes."),
  }),
});

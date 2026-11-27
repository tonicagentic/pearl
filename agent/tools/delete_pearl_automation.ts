import { defineTool } from "eve/tools";
import { schedules } from "eve/experimental/schedules";
import { z } from "zod";

import { deleteAutomationMirror } from "@/lib/automations";
import { requirePrincipalUser } from "#lib/principal.js";

import pearlAutomations from "../schedules/pearl-automations.ts";

export default defineTool({
  description: "Delete a Pearl automation and its schedule.",
  inputSchema: z.object({
    id: z.string().min(1),
    eveScheduleName: z.string().min(1),
  }),
  outputSchema: z.object({
    error: z.string().optional(),
    ok: z.boolean().optional(),
  }),
  async execute(input, ctx) {
    const auth = await requirePrincipalUser(ctx.session.auth.current);
    if ("error" in auth) {
      return { error: "No signed-in user." };
    }

    try {
      const client = await schedules(pearlAutomations);
      await client.delete(input.eveScheduleName);
      const ok = await deleteAutomationMirror({
        userId: auth.userId,
        id: input.id,
      });
      if (!ok) return { error: "Automation not found." };
      return { ok: true };
    } catch (error) {
      return {
        error:
          error instanceof Error
            ? error.message
            : "Could not delete the automation.",
      };
    }
  },
});

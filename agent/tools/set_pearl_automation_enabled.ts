import { defineTool } from "eve/tools";
import { schedules } from "eve/experimental/schedules";
import { z } from "zod";

import { setAutomationEnabled } from "@/lib/automations";
import { requirePrincipalUser } from "#lib/principal.js";

import pearlAutomations from "../schedules/pearl-automations.ts";

export default defineTool({
  description: "Enable or pause a Pearl automation schedule.",
  inputSchema: z.object({
    id: z.string().min(1),
    eveScheduleName: z.string().min(1),
    enabled: z.boolean(),
  }),
  outputSchema: z.object({
    error: z.string().optional(),
    automation: z.unknown().optional(),
  }),
  async execute(input, ctx) {
    const auth = await requirePrincipalUser(ctx.session.auth.current);
    if ("error" in auth) {
      return { error: "No signed-in user." };
    }

    try {
      const client = await schedules(pearlAutomations);
      if (input.enabled) {
        await client.enable(input.eveScheduleName);
      } else {
        await client.disable(input.eveScheduleName);
      }
      const automation = await setAutomationEnabled({
        userId: auth.userId,
        id: input.id,
        enabled: input.enabled,
      });
      return { automation };
    } catch (error) {
      return {
        error:
          error instanceof Error
            ? error.message
            : "Could not update the automation.",
      };
    }
  },
});

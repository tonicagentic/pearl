import { defineTool } from "eve/tools";
import { schedules } from "eve/experimental/schedules";
import { z } from "zod";

import {
  insertAutomationMirror,
  normalizeWriteInput,
} from "@/lib/automations";
import { requirePrincipalUser } from "#lib/principal.js";

import pearlAutomations from "../schedules/pearl-automations.ts";

/**
 * Create a Pearl automation (eve dynamic schedule + UI mirror).
 * Used by the Automations UI via channel invokeTool. No approval gate —
 * the UI already confirms Create; invokeTool cannot wait for HITL.
 */
export default defineTool({
  description:
    "Create a scheduled Pearl automation (one-shot or recurring prompt). " +
    "Prefer letting the user finish this in the Automations UI.",
  inputSchema: z.object({
    name: z.string().min(1).max(120),
    instructions: z.string().min(1).max(20_000),
    triggerKind: z.enum([
      "once",
      "hourly",
      "daily",
      "weekdays",
      "weekly",
      "monthly",
      "annually",
    ]),
    triggerConfig: z.record(z.string(), z.unknown()).optional(),
    timezone: z.string().min(1).max(64),
    notifyPush: z.boolean(),
    notifyEmail: z.boolean(),
    enabled: z.boolean(),
    expression: z.union([
      z.object({
        type: z.literal("single"),
        at: z.string(),
        timezone: z.string(),
      }),
      z.object({
        type: z.literal("cron"),
        cron: z.string(),
        timezone: z.string(),
      }),
    ]),
  }),
  outputSchema: z.object({
    error: z.string().optional(),
    automation: z.unknown().optional(),
  }),
  async execute(input, ctx) {
    const auth = await requirePrincipalUser(ctx.session.auth.current);
    if ("error" in auth) {
      return { error: "No signed-in user to create an automation for." };
    }

    try {
      const fields = normalizeWriteInput({
        name: input.name,
        instructions: input.instructions,
        triggerKind: input.triggerKind,
        triggerConfig: input.triggerConfig as never,
        timezone: input.timezone,
        notifyPush: input.notifyPush,
        notifyEmail: input.notifyEmail,
        enabled: input.enabled,
      });

      const client = await schedules(pearlAutomations);
      const record = await client.create({
        name: fields.name,
        expression: input.expression,
        payload: {
          name: fields.name,
          instructions: fields.instructions,
          triggerKind: fields.triggerKind,
          triggerConfig: fields.triggerConfig,
          timezone: fields.timezone,
          notifyPush: fields.notifyPush,
          notifyEmail: fields.notifyEmail,
        },
      });

      if (!fields.enabled) {
        await client.disable(record.name);
      }

      const automation = await insertAutomationMirror({
        userId: auth.userId,
        fields,
        eveScheduleName: record.name,
      });
      return { automation };
    } catch (error) {
      return {
        error:
          error instanceof Error
            ? error.message
            : "Could not create the automation.",
      };
    }
  },
});

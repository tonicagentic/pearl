import {
  byPrincipal,
  defineDynamicSchedules,
} from "eve/experimental/schedules";
import { z } from "zod";
import { eq } from "drizzle-orm";

import pearlAutomationChannel from "../channels/pearl-automation.ts";
import { db } from "@/lib/db/client";
import { user } from "@/lib/db/schema";

const triggerKindSchema = z.enum([
  "once",
  "hourly",
  "daily",
  "weekdays",
  "weekly",
  "monthly",
  "annually",
]);

const triggerConfigSchema = z
  .object({
    hour: z.number().int().min(0).max(23).optional(),
    minute: z.number().int().min(0).max(59).optional(),
    startHour: z.number().int().min(0).max(23).optional(),
    endHour: z.number().int().min(0).max(23).optional(),
    weekday: z.number().int().min(0).max(6).optional(),
    dayOfMonth: z.number().int().min(1).max(28).optional(),
    month: z.number().int().min(1).max(12).optional(),
    runAt: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
      .optional(),
  })
  .strict();

/**
 * User-created Pearl automations. Timing lives in Vercel Schedules; each
 * occurrence starts a fresh Pearl chat via the pearl-automation channel.
 */
export default defineDynamicSchedules({
  id: "pearl-automations",
  description:
    "Schedule a Pearl prompt to run once or on a recurring cadence. " +
    "Use for reminders, digests, and recurring research.",
  inputSchema: z
    .object({
      name: z.string().min(1).max(120),
      instructions: z.string().min(1).max(20_000),
      triggerKind: triggerKindSchema,
      triggerConfig: triggerConfigSchema.default({}),
      timezone: z.string().min(1).max(64),
      notifyPush: z.boolean().default(true),
      notifyEmail: z.boolean().default(true),
    })
    .strict(),
  scope: byPrincipal,
  // Model can create/update/delete; UI uses code client / admin tools instead.
  approval: {
    create: () => "user-approval",
    update: () => "user-approval",
    delete: () => "user-approval",
    enable: () => "user-approval",
    disable: () => "user-approval",
  },
  async auth({ principal, schedule }) {
    const [row] = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        isAnonymous: user.isAnonymous,
      })
      .from(user)
      .where(eq(user.id, principal.principalId))
      .limit(1);

    if (!row || row.isAnonymous) {
      await schedule.disable();
      return null;
    }

    return {
      attributes: {
        email: row.email,
        name: row.name,
      },
    };
  },
  async run({ payload, occurrence, to, schedule, auth }) {
    const userId = auth.principalId;
    await to(pearlAutomationChannel, {
      userId,
      automationName: payload.name,
      eveScheduleName: occurrence.name,
    }).send(payload.instructions, {
      title: payload.name,
      idempotencyKey: `${occurrence.executionId}:pearl-automation`,
    });

    // One-shot schedules complete after the provider fires; disable as a
    // belt-and-suspenders so a retry cannot start another chat.
    if (payload.triggerKind === "once") {
      await schedule.disable();
    }
  },
});

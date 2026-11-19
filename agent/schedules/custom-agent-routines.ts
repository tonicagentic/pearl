import { defineSchedule } from "eve/schedules";
import { and, eq, isNotNull, isNull } from "drizzle-orm";

import { routineDueInWindow } from "@/lib/custom-agents/cron";
import { db } from "@/lib/db/client";
import {
  chat,
  customAgent,
  customAgentRoutine,
  user,
} from "@/lib/db/schema";

import routineChannel from "../channels/custom-agent-routine.ts";

/**
 * Dispatcher for per-agent DB routines. Cadence is every 15 minutes (Vercel
 * schedule floor). Definitions live in custom_agent_routine rows — not as
 * schedule files.
 */
export default defineSchedule({
  cron: "*/15 * * * *",
  timezone: "UTC",
  async run({ to, waitUntil }) {
    const rows = await db
      .select({
        routine: customAgentRoutine,
        agentId: customAgent.id,
        userId: customAgent.userId,
        chatId: chat.id,
        userName: user.name,
        userEmail: user.email,
      })
      .from(customAgentRoutine)
      .innerJoin(customAgent, eq(customAgent.id, customAgentRoutine.agentId))
      .innerJoin(chat, eq(chat.customAgentId, customAgent.id))
      .innerJoin(user, eq(user.id, customAgent.userId))
      .where(
        and(
          eq(customAgentRoutine.enabled, true),
          isNotNull(customAgentRoutine.cron),
        ),
      );

    const now = new Date();
    for (const row of rows) {
      if (
        !routineDueInWindow({
          cron: row.routine.cron,
          timezone: row.routine.timezone,
          lastRunAt: row.routine.lastRunAt,
          now,
        })
      ) {
        continue;
      }

      // Claim before send so overlapping dispatchers don't double-fire.
      const claimed = await db
        .update(customAgentRoutine)
        .set({ lastRunAt: now, updatedAt: now })
        .where(
          and(
            eq(customAgentRoutine.id, row.routine.id),
            row.routine.lastRunAt
              ? eq(customAgentRoutine.lastRunAt, row.routine.lastRunAt)
              : isNull(customAgentRoutine.lastRunAt),
          ),
        )
        .returning({ id: customAgentRoutine.id });
      if (claimed.length === 0) continue;

      const auth = {
        attributes: {
          email: row.userEmail,
          name: row.userName,
        },
        authenticator: "better-auth",
        issuer: "better-auth",
        principalId: row.userId,
        principalType: "user" as const,
        subject: row.userEmail,
      };

      waitUntil(
        to(routineChannel, {
          chatId: row.chatId,
          agentId: row.agentId,
          userId: row.userId,
        }).send(row.routine.prompt, {
          auth,
          title: row.routine.name,
          idempotencyKey: `routine:${row.routine.id}:${now.toISOString().slice(0, 16)}`,
        }),
      );
    }
  },
});

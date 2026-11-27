import { defineTool } from "eve/tools";
import { once } from "eve/tools/approval";
import { z } from "zod";

import { getGoal, updateGoal } from "@/lib/db/project-goals";
import { getProject, getProjectByName } from "@/lib/db/projects";
import { requirePrincipalUser } from "#lib/principal.js";
import { isPlanMode, planModeBlocked } from "#lib/turn-context.js";

function formatUpdateGoalPrompt(input: {
  readonly goalId: string;
  readonly title?: string;
  readonly status?: "active" | "done";
  readonly notes?: string | null;
  readonly targetDate?: string | null;
  readonly projectName?: string | null;
}): string {
  if (input.status === "done") {
    const label = input.title?.trim() || `goal ${input.goalId}`;
    return `Mark this goal done?\n${label}`;
  }
  const lines = ["Update this goal?"];
  if (input.title?.trim()) lines.push(input.title.trim());
  else lines.push(`id: ${input.goalId}`);
  if (input.status) lines.push(`Status: ${input.status}`);
  if (input.notes != null && input.notes.trim()) {
    lines.push(`Notes: ${input.notes.trim()}`);
  }
  if (input.targetDate != null && input.targetDate.trim()) {
    lines.push(`Target: ${input.targetDate.trim()}`);
  }
  if (input.projectName != null) {
    lines.push(
      input.projectName.trim()
        ? `Project: ${input.projectName.trim()}`
        : "Standalone (no project)",
    );
  }
  return lines.join("\n");
}

/**
 * Update a goal on Pearl's Goals list (title, status, dates, notes, filing).
 *
 * Find the id with list_goals. Marking done should only happen when the user
 * says the outcome is achieved. Plan mode is blocked.
 */
const tool = defineTool({
  approval: {
    request: once(),
    prompt: ({ input }) => formatUpdateGoalPrompt(input),
  },
  description:
    "Update one of the user's goals: title, status (active|done), target " +
    "date, notes, or project filing. Find the id with list_goals. Mark " +
    "status done only when the user says the outcome is achieved — not from " +
    "a third-party claim. Blocked in Plan mode.",
  async execute(input, ctx) {
    if (isPlanMode()) {
      return planModeBlocked("update_goal");
    }

    const auth = await requirePrincipalUser(ctx.session.auth.current);
    if ("error" in auth) {
      return { error: "No signed-in user to update a goal for." };
    }
    const { userId } = auth;

    const existing = await getGoal(userId, input.goalId);
    if (!existing) {
      return {
        error: "No goal with that id. List goals first and use its id.",
      };
    }

    let projectId: string | null | undefined;
    if (input.projectId !== undefined) {
      if (input.projectId === null || input.projectId.trim() === "") {
        projectId = null;
      } else {
        const known = await getProject(userId, input.projectId.trim());
        if (!known) return { error: "Unknown project id." };
        projectId = known.id;
      }
    } else if (input.projectName !== undefined) {
      if (input.projectName === null || input.projectName.trim() === "") {
        projectId = null;
      } else {
        const known = await getProjectByName(userId, input.projectName.trim());
        if (!known) return { error: "Unknown project name." };
        projectId = known.id;
      }
    }

    try {
      const goal = await updateGoal(userId, input.goalId, {
        title: input.title,
        status: input.status,
        targetDate: input.targetDate,
        notes: input.notes,
        projectId,
      });
      if (!goal) {
        return { error: "Could not update the goal." };
      }
      return {
        id: goal.id,
        title: goal.title,
        status: goal.status,
        targetDate: goal.targetDate,
        notes: goal.notes,
        projectId: goal.projectId,
        projectName: goal.projectName,
      };
    } catch (error) {
      return {
        error:
          error instanceof Error ? error.message : "Could not update the goal.",
      };
    }
  },
  inputSchema: z.object({
    goalId: z.string(),
    title: z.string().max(200).optional(),
    status: z.enum(["active", "done"]).optional(),
    notes: z.string().max(20_000).nullable().optional(),
    targetDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable()
      .optional(),
    projectName: z.string().max(120).nullable().optional(),
    projectId: z.string().nullable().optional(),
  }),
  outputSchema: z.object({
    error: z.string().optional(),
    id: z.string().optional(),
    title: z.string().optional(),
    status: z.string().optional(),
    targetDate: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
    projectId: z.string().nullable().optional(),
    projectName: z.string().nullable().optional(),
  }),
});

// Always available — “mark that goal done” is short voice-lane chat.
export default tool;

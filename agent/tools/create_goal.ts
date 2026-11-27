import { defineTool } from "eve/tools";
import { once } from "eve/tools/approval";
import { z } from "zod";

import { createGoal } from "@/lib/db/project-goals";
import { getProject, getProjectByName } from "@/lib/db/projects";
import { requirePrincipalUser } from "#lib/principal.js";
import {
  isPlanMode,
  planModeBlocked,
  turnClientIntent,
} from "#lib/turn-context.js";

function formatCreateGoalPrompt(input: {
  readonly title: string;
  readonly notes?: string;
  readonly targetDate?: string;
  readonly projectName?: string;
  readonly projectId?: string;
}): string {
  const lines = [`Save this goal?`, input.title.trim()];
  if (input.notes?.trim()) {
    lines.push(`Done looks like: ${input.notes.trim()}`);
  }
  if (input.targetDate?.trim()) {
    lines.push(`Target: ${input.targetDate.trim()}`);
  }
  if (input.projectName?.trim()) {
    lines.push(`Project: ${input.projectName.trim()}`);
  } else if (input.projectId?.trim()) {
    lines.push(`Project id: ${input.projectId.trim()}`);
  } else {
    lines.push("Standalone (no project)");
  }
  return lines.join("\n");
}

/**
 * Record an outcome on Pearl's Goals list.
 *
 * Gated with once(): first create in a turn needs approval, then follow-ups
 * in the same turn flow without re-prompting. Plan mode is blocked.
 */
const tool = defineTool({
  approval: {
    request: once(),
    prompt: ({ input }) => formatCreateGoalPrompt(input),
  },
  description:
    "Save a goal on Pearl's Goals list: a trackable outcome (title, optional " +
    "target date YYYY-MM-DD, optional notes for what done looks like). " +
    "Optionally file under a project (projectName or projectId). When the " +
    "chat is attached to a project and none is passed, file on that project. " +
    "Not for open loops (use create_issue) or plan-file bullets (use " +
    "write_project_file in Plan mode). Prefer a GoalDefinition card in the " +
    "reply when proposing the final definition.",
  async execute(input, ctx) {
    if (isPlanMode()) {
      return planModeBlocked("create_goal");
    }

    const auth = await requirePrincipalUser(ctx.session.auth.current);
    if ("error" in auth) {
      return { error: "No signed-in user to create a goal for." };
    }
    const { userId } = auth;

    const title = input.title.trim();
    if (!title) {
      return { error: "The goal needs a title." };
    }

    let projectId: string | null = null;
    let projectName: string | null = null;

    if (input.projectId?.trim()) {
      const known = await getProject(userId, input.projectId.trim());
      if (!known) {
        return { error: "Unknown project id." };
      }
      projectId = known.id;
      projectName = known.name;
    } else if (input.projectName?.trim()) {
      const known = await getProjectByName(userId, input.projectName.trim());
      if (!known) {
        return {
          error:
            "Unknown project name. Use an existing project, or omit it to " +
            "leave the goal standalone.",
        };
      }
      projectId = known.id;
      projectName = known.name;
    } else {
      const attached = turnClientIntent.get().projectId;
      if (attached) {
        const known = await getProject(userId, attached);
        if (known) {
          projectId = known.id;
          projectName = known.name;
        }
      }
    }

    try {
      const goal = await createGoal(userId, {
        title,
        projectId,
        targetDate: input.targetDate ?? null,
        notes: input.notes?.trim() || null,
      });
      return {
        id: goal.id,
        title: goal.title,
        status: goal.status,
        targetDate: goal.targetDate,
        notes: goal.notes,
        projectId: goal.projectId,
        projectName: goal.projectName ?? projectName,
      };
    } catch (error) {
      return {
        error:
          error instanceof Error ? error.message : "Could not create the goal.",
      };
    }
  },
  inputSchema: z.object({
    title: z.string().max(200),
    notes: z.string().max(20_000).optional(),
    targetDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    projectName: z.string().max(120).optional(),
    projectId: z.string().optional(),
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

// Always available (like create_project): goal walkthroughs continue with
// free-text ask_question answers that would otherwise land on the voice lane
// and hide a toolSurfaceEnabled gate.
export default tool;

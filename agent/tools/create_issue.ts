import { defineDynamic, defineTool } from "eve/tools";
import { toolSurfaceEnabled } from "#lib/lane-state.js";
import { once } from "eve/tools/approval";
import { z } from "zod";
import {
  createIssue,
  createArea,
  ensureUserForPrincipal,
  findAreaByName,
  getArea,
} from "@/lib/db/issues";
import { getGoal } from "@/lib/db/project-goals";
import { getProject, getProjectByName } from "@/lib/db/projects";
import { isPlanMode, planModeBlocked } from "#lib/turn-context.js";

/**
 * Tool that captures an unresolved area as an issue.
 *
 * @remarks
 * Scoped to the framework-resolved principal (`ctx.session.auth.current`), never
 * to model input. Gated with once(): the first capture in a turn needs the
 * user's approval, then follow-ups in the same turn flow without re-prompting —
 * capture stays low-friction while remaining behind the repo's code-enforced
 * gate for create_/update_-patterned tools (tests/approval-gates.test.ts).
 * Areas resolve by name (case-insensitive); an unknown name creates
 * a matching area instead of failing, so a capture never dead-ends.
 */
const tool = defineTool({
  approval: once(),
  description:
    "Record something unresolved the user is holding in their head: an issue attached to an " +
    "area of their life that will need attention before it is settled. Not for bookkeeping or " +
    "general notes. Optionally file it under an existing project (projectName or projectId) " +
    "and/or an existing goal (goalId). Offer a review date — when this should come back to " +
    "the user's attention — because resurfacing at the right time is the point.",
  /**
   * Create an issue for the current principal.
   *
   * @param input - Title, area (name or id), optional notes and dates.
   * @param ctx - Tool runtime context; supplies the resolved principal.
   */
  async execute(input, ctx) {
    if (isPlanMode()) {
      return planModeBlocked("create_issue");
    }

    const principal = ctx.session.auth.current;
    const userId =
      principal?.principalType === "user" ? principal.principalId : null;

    if (!principal || !userId) {
      return { error: "No signed-in user to create an issue for." };
    }

    await ensureUserForPrincipal(principal);

    const title = input.title.trim();

    if (!title) {
      return { error: "The issue needs a title." };
    }

    let areaId: string | undefined;

    if (input.areaId) {
      const known = await getArea(userId, input.areaId);

      if (!known) {
        return { error: "Unknown area id." };
      }

      areaId = known.id;
    } else if (input.areaName) {
      const name = input.areaName.trim();
      const existing = await findAreaByName(userId, name);
      areaId =
        existing?.id ?? (await createArea(userId, name)).id;
    }

    if (!areaId) {
      return {
        error:
          "No area given. Ask which area of the user's life this belongs to.",
      };
    }

    let projectId: string | null = null;

    if (input.projectId) {
      const known = await getProject(userId, input.projectId);
      if (!known) {
        return { error: "Unknown project id." };
      }
      projectId = known.id;
    } else if (input.projectName) {
      const known = await getProjectByName(userId, input.projectName);
      if (!known) {
        return {
          error:
            "Unknown project name. Use an existing project, or omit it to leave the issue in the inbox.",
        };
      }
      projectId = known.id;
    }

    let goalId: string | null = null;
    if (input.goalId) {
      const known = await getGoal(userId, input.goalId);
      if (!known) {
        return { error: "Unknown goal id." };
      }
      goalId = known.id;
      if (!projectId && known.projectId) {
        projectId = known.projectId;
      }
    }

    const issue = await createIssue(userId, {
      title,
      description: input.description?.trim() || null,
      areaId,
      projectId,
      goalId,
      dueDate: input.dueDate ?? null,
      reviewDate: input.reviewDate ?? null,
    });

    return {
      id: issue.id,
      title: issue.title,
      area: issue.areaName,
      projectId: issue.projectId,
      goalId: issue.goalId,
      dueDate: issue.dueDate,
      reviewDate: issue.reviewDate,
    };
  },
  inputSchema: z.object({
    title: z.string().max(200),
    areaName: z.string().max(80).optional(),
    areaId: z.string().optional(),
    // Optional project workspace. Unknown names fail closed (unlike areas)
    // so chat does not invent empty projects.
    projectName: z.string().max(120).optional(),
    projectId: z.string().optional(),
    goalId: z.string().optional(),
    description: z.string().max(4000).optional(),
    // Calendar dates (YYYY-MM-DD): dueDate is when it must be resolved;
    // reviewDate is when it should return to the user's attention.
    dueDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    reviewDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
  }),
  outputSchema: z.object({
    error: z.string().optional(),
    id: z.string().optional(),
    title: z.string().optional(),
    area: z.string().optional(),
    projectId: z.string().nullable().optional(),
    goalId: z.string().nullable().optional(),
    dueDate: z.string().nullable().optional(),
    reviewDate: z.string().nullable().optional(),
  }),
});

export default defineDynamic(() =>
  toolSurfaceEnabled() ? tool : null,
);


import { defineTool } from "eve/tools";
import { z } from "zod";

import {
  listAllGoals,
  listProjectGoals,
} from "@/lib/db/project-goals";
import { getProject, getProjectByName } from "@/lib/db/projects";
import { requirePrincipalUser } from "#lib/principal.js";

/**
 * List the user's Goals (outcomes on the Goals list).
 *
 * Defaults to active goals. Pass status "done" or "all" when asked for
 * completed goals. Optional projectId / projectName scopes to one workspace.
 */
const tool = defineTool({
  description:
    "List the user's goals: trackable outcomes on Pearl's Goals list " +
    "(title, status, target date, notes, optional project). Defaults to " +
    "active goals. Pass status \"done\" for completed ones, or \"all\" for " +
    "both. Optionally scope with projectId or projectName. Use this to " +
    "answer \"what am I working toward?\" — not as open loops (use list_issues).",
  async execute(input, ctx) {
    const auth = await requirePrincipalUser(ctx.session.auth.current);
    if ("error" in auth) {
      return { error: "No signed-in user to list goals for.", goals: [] };
    }
    const { userId } = auth;

    let projectId: string | undefined;
    if (input.projectId?.trim()) {
      const owned = await getProject(userId, input.projectId.trim());
      if (!owned) {
        return { error: "Unknown project id.", goals: [] };
      }
      projectId = owned.id;
    } else if (input.projectName?.trim()) {
      const owned = await getProjectByName(userId, input.projectName.trim());
      if (!owned) {
        return { error: "Unknown project name.", goals: [] };
      }
      projectId = owned.id;
    }

    const rows = projectId
      ? await listProjectGoals(userId, projectId)
      : await listAllGoals(userId);

    const statusFilter = input.status ?? "active";
    const goals = rows
      .filter((row) =>
        statusFilter === "all" ? true : row.status === statusFilter,
      )
      .map((row) => ({
        id: row.id,
        title: row.title,
        status: row.status,
        targetDate: row.targetDate,
        notes: row.notes,
        projectId: row.projectId,
        projectName: row.projectName,
      }));

    return { goals };
  },
  inputSchema: z.object({
    status: z.enum(["active", "done", "all"]).optional(),
    projectId: z.string().optional(),
    projectName: z.string().max(120).optional(),
  }),
  outputSchema: z.object({
    error: z.string().optional(),
    goals: z.array(
      z.object({
        id: z.string(),
        title: z.string(),
        status: z.string(),
        targetDate: z.string().nullable(),
        notes: z.string().nullable(),
        projectId: z.string().nullable(),
        projectName: z.string().nullable(),
      }),
    ),
  }),
});

// Always available — “what am I working toward?” is short voice-lane chat.
export default tool;

import { defineTool } from "eve/tools";
import { z } from "zod";

import { getProject } from "@/lib/db/projects";
import { listProjectFiles } from "@/lib/project-files";

import { requirePrincipalUser } from "#lib/principal.js";
import { turnClientIntent } from "#lib/turn-context.js";

/**
 * @deprecated Prefer list_project_files. Alias for plan-mode evals/skills.
 */
export default defineTool({
  description:
    "List plan markdown files in a project. Alias of list_project_files " +
    "filtered to docs/plans/<projectId>/ when possible.",
  async execute(input, ctx) {
    const auth = await requirePrincipalUser(ctx.session.auth.current);
    if ("error" in auth) {
      return { error: "No signed-in user to list plans for." };
    }
    const { userId } = auth;

    const projectId =
      input.projectId?.trim() || turnClientIntent.get().projectId;
    if (!projectId) {
      return {
        error:
          "No project given. Attach the chat to a project or pass projectId.",
      };
    }

    const owned = await getProject(userId, projectId);
    if (!owned) {
      return { error: "Unknown project id." };
    }

    const files = await listProjectFiles(userId, projectId);
    const plans = files
      .filter((row) => row.pathname.includes(`docs/plans/${projectId}/`))
      .map((row) => {
        const base = row.pathname.split("/").pop() ?? row.title;
        const slug = base.replace(/\.md$/i, "");
        return {
          id: row.id,
          title: row.title,
          slug,
          updatedAt: row.createdAt,
        };
      });

    // If nothing under docs/plans yet, surface all project files as plans.
    const listed =
      plans.length > 0
        ? plans
        : files.map((row) => ({
            id: row.id,
            title: row.title,
            slug: (row.pathname.split("/").pop() ?? row.title).replace(
              /\.md$/i,
              "",
            ),
            updatedAt: row.createdAt,
          }));

    return {
      projectId,
      projectName: owned.name,
      plans: listed,
    };
  },
  inputSchema: z.object({
    projectId: z.string().optional(),
  }),
  outputSchema: z.object({
    error: z.string().optional(),
    projectId: z.string().optional(),
    projectName: z.string().optional(),
    plans: z
      .array(
        z.object({
          id: z.string(),
          title: z.string(),
          slug: z.string(),
          updatedAt: z.string(),
        }),
      )
      .optional(),
  }),
});

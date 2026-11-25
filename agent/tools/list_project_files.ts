import { defineTool } from "eve/tools";
import { z } from "zod";

import { listProjectFiles } from "@/lib/project-files";

import { requirePrincipalUser } from "#lib/principal.js";
import { turnClientIntent } from "#lib/turn-context.js";

/** List files linked to a project. */
export default defineTool({
  description:
    "List files linked to a project (Library artifacts on the project). " +
    "Defaults to the active project. Returns id, title, pathname for each.",
  async execute(input, ctx) {
    const auth = await requirePrincipalUser(ctx.session.auth.current);
    if ("error" in auth) {
      return { error: "No signed-in user to list project files for." };
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

    try {
      const files = await listProjectFiles(userId, projectId);
      return {
        projectId,
        files: files.map((row) => ({
          id: row.id,
          title: row.title,
          pathname: row.pathname,
        })),
      };
    } catch (error) {
      return {
        error:
          error instanceof Error
            ? error.message
            : "Could not list project files.",
      };
    }
  },
  inputSchema: z.object({
    projectId: z.string().optional(),
  }),
  outputSchema: z.object({
    error: z.string().optional(),
    projectId: z.string().optional(),
    files: z
      .array(
        z.object({
          id: z.string(),
          title: z.string(),
          pathname: z.string(),
        }),
      )
      .optional(),
  }),
});

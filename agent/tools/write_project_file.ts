import { defineTool } from "eve/tools";
import { z } from "zod";

import { putProjectMarkdownFile } from "@/lib/project-files";

import { requirePrincipalUser } from "#lib/principal.js";
import { turnClientIntent } from "#lib/turn-context.js";

/**
 * Create or replace a markdown file in a project's files folder.
 * The one write allowed in Plan mode (under docs/plans/<projectId>/).
 */
export default defineTool({
  description:
    "Create or replace a markdown file in a project (Blob + project files). " +
    "Pass title and markdown; optional slug (from title when omitted). " +
    "Defaults to the active project. Writes to /workspace/docs/plans/<projectId>/<slug>.md " +
    "and links it on the project. Prefer this in Plan mode instead of write_file.",
  async execute(input, ctx) {
    const auth = await requirePrincipalUser(ctx.session.auth.current);
    if ("error" in auth) {
      return { error: "No signed-in user to save a project file for." };
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
      const written = await putProjectMarkdownFile({
        userId,
        projectId,
        title: input.title,
        slug: input.slug,
        markdown: input.markdown,
        session: {
          id: ctx.session.id,
          getSandbox: () => ctx.getSandbox(),
        },
      });

      return {
        id: written.artifact.id,
        projectId,
        title: written.title,
        slug: written.slug,
        path: written.path,
        pathname: written.pathname,
        mirrored: written.mirrored,
        note: written.note,
      };
    } catch (error) {
      return {
        error:
          error instanceof Error
            ? error.message
            : "Could not save the project file.",
      };
    }
  },
  inputSchema: z.object({
    title: z.string().max(200),
    markdown: z.string().max(200_000),
    slug: z.string().max(80).optional(),
    projectId: z.string().optional(),
  }),
  outputSchema: z.object({
    error: z.string().optional(),
    id: z.string().optional(),
    projectId: z.string().optional(),
    title: z.string().optional(),
    slug: z.string().optional(),
    path: z.string().optional(),
    pathname: z.string().optional(),
    mirrored: z.boolean().optional(),
    note: z.string().optional(),
  }),
});

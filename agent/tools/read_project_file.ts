import { defineTool } from "eve/tools";
import { z } from "zod";

import {
  readProjectFileByArtifactId,
  readProjectFileBySlug,
} from "@/lib/project-files";

import { requirePrincipalUser } from "#lib/principal.js";
import { turnClientIntent } from "#lib/turn-context.js";

/** Read a project markdown file by artifact id or slug. */
export default defineTool({
  description:
    "Read a project markdown file. Pass artifactId, or slug (+ projectId). " +
    "Defaults to the active project. Returns title, path, and markdown body.",
  async execute(input, ctx) {
    const auth = await requirePrincipalUser(ctx.session.auth.current);
    if ("error" in auth) {
      return { error: "No signed-in user to read a project file for." };
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
      const file = input.artifactId
        ? await readProjectFileByArtifactId({
            userId,
            projectId,
            artifactId: input.artifactId,
          })
        : input.slug
          ? await readProjectFileBySlug({
              userId,
              projectId,
              slug: input.slug.trim(),
            })
          : null;

      if (!file) {
        return {
          error:
            "File not found. Pass artifactId from list_project_files, or a slug.",
        };
      }

      return {
        id: file.artifact.id,
        projectId,
        title: file.title,
        slug: file.slug,
        path: file.path,
        markdown: file.markdown,
      };
    } catch (error) {
      return {
        error:
          error instanceof Error
            ? error.message
            : "Could not read the project file.",
      };
    }
  },
  inputSchema: z.object({
    artifactId: z.string().optional(),
    slug: z.string().optional(),
    projectId: z.string().optional(),
  }),
  outputSchema: z.object({
    error: z.string().optional(),
    id: z.string().optional(),
    projectId: z.string().optional(),
    title: z.string().optional(),
    slug: z.string().optional(),
    path: z.string().optional(),
    markdown: z.string().optional(),
  }),
});

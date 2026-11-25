import { defineTool } from "eve/tools";
import { z } from "zod";

import {
  readProjectFileByArtifactId,
  readProjectFileBySlug,
} from "@/lib/project-files";

import { requirePrincipalUser } from "#lib/principal.js";
import { turnClientIntent } from "#lib/turn-context.js";

/**
 * @deprecated Prefer read_project_file. Alias for plan-mode evals/skills.
 */
export default defineTool({
  description:
    "Read a project plan markdown file by artifact id (planId) or slug. " +
    "Alias of read_project_file — prefer that name. File is source of truth.",
  async execute(input, ctx) {
    const auth = await requirePrincipalUser(ctx.session.auth.current);
    if ("error" in auth) {
      return { error: "No signed-in user to read a plan for." };
    }
    const { userId } = auth;

    if (input.planId) {
      const projectId =
        input.projectId?.trim() || turnClientIntent.get().projectId;
      if (!projectId) {
        return {
          error:
            "Pass projectId (or attach a project) with planId/artifact id.",
        };
      }
      const file = await readProjectFileByArtifactId({
        userId,
        projectId,
        artifactId: input.planId,
      });
      if (!file) return { error: "Unknown plan id." };
      return {
        id: file.artifact.id,
        projectId,
        title: file.title,
        slug: file.slug,
        markdown: file.markdown,
      };
    }

    const projectId =
      input.projectId?.trim() || turnClientIntent.get().projectId;
    const slug = input.slug?.trim();
    if (!projectId || !slug) {
      return {
        error: "Pass planId, or both projectId (or an active project) and slug.",
      };
    }

    const file = await readProjectFileBySlug({ userId, projectId, slug });
    if (!file) return { error: "No plan with that slug in this project." };

    return {
      id: file.artifact.id,
      projectId,
      title: file.title,
      slug: file.slug,
      markdown: file.markdown,
    };
  },
  inputSchema: z.object({
    planId: z.string().optional(),
    projectId: z.string().optional(),
    slug: z.string().optional(),
  }),
  outputSchema: z.object({
    error: z.string().optional(),
    id: z.string().optional(),
    projectId: z.string().optional(),
    title: z.string().optional(),
    slug: z.string().optional(),
    markdown: z.string().optional(),
  }),
});

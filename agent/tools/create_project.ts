import { defineTool } from "eve/tools";
import { once } from "eve/tools/approval";
import { z } from "zod";

import { createProject, getProjectByName } from "@/lib/db/projects";

import { requirePrincipalUser } from "#lib/principal.js";
import { isPlanMode, planModeBlocked } from "#lib/turn-context.js";

/**
 * Create a project workspace by name. Plan mode must not invent projects.
 */
export default defineTool({
  approval: once(),
  description:
    "Create a project workspace (name, optional instructions) for plans and " +
    "related chats. Only when the user asks for a project by name — Plan mode " +
    "does not invent one.",
  async execute(input, ctx) {
    if (isPlanMode()) {
      return planModeBlocked("create_project");
    }

    const auth = await requirePrincipalUser(ctx.session.auth.current);
    if ("error" in auth) {
      return { error: "No signed-in user to create a project for." };
    }
    const { userId } = auth;

    const name = input.name.trim();
    if (!name) return { error: "A project needs a name." };

    const existing = await getProjectByName(userId, name);
    if (existing) {
      return {
        id: existing.id,
        name: existing.name,
        existed: true,
      };
    }

    try {
      const row = await createProject(userId, {
        name,
        instructions: input.instructions,
      });
      return { id: row.id, name: row.name, existed: false };
    } catch (error) {
      return {
        error:
          error instanceof Error
            ? error.message
            : "Could not create the project.",
      };
    }
  },
  inputSchema: z.object({
    name: z.string().max(120),
    instructions: z.string().max(20_000).optional(),
  }),
  outputSchema: z.object({
    error: z.string().optional(),
    id: z.string().optional(),
    name: z.string().optional(),
    existed: z.boolean().optional(),
  }),
});

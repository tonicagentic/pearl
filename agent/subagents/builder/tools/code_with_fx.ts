import { defineTool } from "eve/tools";
import { z } from "zod";

import { codeWithFx } from "@/lib/apps/code-service";

export default defineTool({
  description:
    "Run a coding task for an existing mini app with fx inside its Vercel Sandbox. " +
    "Pass the app id from create_app or list_apps, and a concrete task. Returns a short " +
    "summary — not the full transcript.",
  inputSchema: z.object({
    appId: z.string().min(1).describe("Mini app id from create_app / list_apps."),
    task: z
      .string()
      .min(1)
      .describe("What fx should implement or fix in /workspace."),
  }),
  async execute(input, ctx) {
    const principal = ctx.session.auth.current;
    const userId =
      principal?.principalType === "user" ? principal.principalId : null;
    if (!principal || !userId) {
      return { status: "error", error: "No signed-in user." };
    }

    return codeWithFx({
      userId,
      appId: input.appId,
      task: input.task,
    });
  },
});

import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";

import { publishApp } from "@/lib/apps/publish-service";

export default defineTool({
  approval: always(),
  description:
    "Create the pearl-* GitHub repo if needed, push the sandbox workspace, ensure a " +
    "Vercel project linked to that repo, wait for production, and save the URL. " +
    "Requires approval. The app then opens in Pearl at /apps/<id>.",
  inputSchema: z.object({
    appId: z.string().min(1).describe("Mini app id from create_app / list_apps."),
    commitMessage: z
      .string()
      .nullish()
      .describe("Optional git commit message for this publish."),
  }),
  async execute(input, ctx) {
    const principal = ctx.session.auth.current;
    const userId =
      principal?.principalType === "user" ? principal.principalId : null;
    if (!principal || !userId) {
      return { status: "error", error: "No signed-in user." };
    }

    return publishApp({
      userId,
      appId: input.appId,
      commitMessage: input.commitMessage ?? undefined,
    });
  },
});

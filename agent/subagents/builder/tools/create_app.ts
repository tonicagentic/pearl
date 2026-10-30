import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";

import { createApp } from "@/lib/apps/create-service";

export default defineTool({
  approval: always(),
  description:
    "Register a new Pearl mini app draft (slug + title) with a Vercel Sandbox " +
    "coding session. Does not require GitHub yet — follow with code_with_fx to " +
    "build in the sandbox, then publish_app (needs GitHub + Vercel Connect) to " +
    "create the private pearl-<slug> repo and deploy. Requires approval.",
  inputSchema: z.object({
    slug: z
      .string()
      .min(1)
      .describe(
        "Short slug: my-notes or pearl-my-notes. Becomes the GitHub repo name pearl-<slug> on publish.",
      ),
    title: z
      .string()
      .min(1)
      .describe("Human-readable app title shown in Pearl's Apps list."),
  }),
  async execute(input, ctx) {
    const principal = ctx.session.auth.current;
    const userId =
      principal?.principalType === "user" ? principal.principalId : null;
    if (!principal || !userId) {
      return { status: "error", error: "No signed-in user." };
    }

    return createApp({
      userId,
      userName:
        typeof principal.attributes?.name === "string"
          ? principal.attributes.name
          : undefined,
      userEmail:
        typeof principal.attributes?.email === "string"
          ? principal.attributes.email
          : undefined,
      slug: input.slug,
      title: input.title,
    });
  },
});

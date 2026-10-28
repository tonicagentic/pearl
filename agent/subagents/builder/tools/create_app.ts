import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";

import { createApp } from "@/lib/apps/create-service";

export default defineTool({
  approval: always(),
  description:
    "Create a new private pearl-<slug> GitHub repo for a mini app, seed a Next.js " +
    "starter, and register it in Pearl. Requires approval. Does not deploy yet — " +
    "follow with code_with_fx and publish_app.",
  inputSchema: z.object({
    slug: z
      .string()
      .min(1)
      .describe(
        "Short slug: my-notes or pearl-my-notes. Becomes the GitHub repo name pearl-<slug>.",
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

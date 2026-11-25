import { defineTool } from "eve/tools";
import { z } from "zod";

import { requireCoderUserId } from "@/lib/coder/principal";
import { checkShipAccess } from "@/lib/coder/ship-access";

/**
 * Preflight before coding or pushing. Verifies the signed-in user's Connect
 * grants can push to owner/repo and reach Vercel. When the grant is short,
 * returns an authorize URL — do not clone or edit until status is ok.
 */
export default defineTool({
  description:
    "Verify Pearl's GitHub (and Vercel) Connect grants can ship to " +
    "owner/repo before cloning or editing. Call at the start of a ship " +
    "task and again before the first push if a prior git__gh call returned " +
    "403. When status is blocked, open the returned authorizeUrl / " +
    "manageUrl for the user and stop — do not invent access. After ok, " +
    "still use gated_git for the first push and draft PR.",
  inputSchema: z.object({
    owner: z.string().min(1).describe("GitHub owner (user or organization)."),
    repo: z.string().min(1).describe("Repository name."),
    checkVercel: z
      .boolean()
      .nullish()
      .describe(
        "When false, only check GitHub (PR-only tasks). Default true.",
      ),
  }),
  async execute(input, ctx) {
    const auth = requireCoderUserId(ctx.session.auth.current);
    if ("error" in auth) return { status: "error", error: auth.error };

    const result = await checkShipAccess({
      userId: auth.userId,
      owner: input.owner,
      repo: input.repo,
      checkVercel: input.checkVercel ?? true,
    });

    return {
      status: result.status,
      github: result.github,
      vercel: result.vercel,
      nextStep: result.nextStep,
      owner: input.owner.trim(),
      repo: input.repo.trim(),
    };
  },
});

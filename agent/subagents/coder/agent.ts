import { defineAgent, defineDynamic } from "eve";

import { readTurnClientIntent } from "../../lib/turn-context.ts";
import { resolveCoderModel } from "./model-router.ts";

/**
 * Coder subagent — the only coding specialist.
 *
 * Own sandbox (Vercel) with eve-code + eve-git extensions. Creates/edits
 * GitHub repos, opens draft PRs, deploys to the user's Vercel account, and
 * submits iOS builds through Expo EAS. Omitted in Plan mode so planning
 * cannot mutate code.
 *
 * Model is chosen when the subagent is selected (Sol by default, Astra when
 * hard or after failures) via AI Gateway — see model-router.ts. Eve requires
 * dynamic subagents to return a static model; per-call nesting of
 * defineModelDynamic is rejected with REACTION_FAILED.
 */
const CODER_DESCRIPTION =
  "Implement, review, and ship code for the signed-in user on their GitHub " +
  "repos. Check out or create a private repo in a Vercel Sandbox, follow the " +
  "repo's AGENTS.md, open a draft pull request, publish a sandbox dev-server " +
  "URL, deploy to the user's Vercel account (preview by default), start Expo " +
  "Simulators sessions, publish EAS Updates, and start Expo EAS iOS builds. " +
  "Delegate for any request to build, change, deploy, or compile code. Pass " +
  "the repo (or 'create one'), the goal, and constraints in message; continue " +
  "the same task with taskId. The child owns coding tools, git__gh, gated_git, " +
  "publish_dev_server, deploy_vercel, merge_pr, expo_simulator, eas_update, " +
  "eas_build, eas_submit, preview_check, deployment_logs, and run_with_env.";

export default defineDynamic(async (ctx) => {
  if (readTurnClientIntent(await ctx.messages()).mode === "plan") {
    return null;
  }

  // Do not set `experimental` or a nested defineModelDynamic here: dynamic
  // subagent resolvers can only return a static-model defineAgent (or null).
  const selection = await resolveCoderModel(ctx);
  return defineAgent({
    description: CODER_DESCRIPTION,
    model: selection.model,
    modelOptions: selection.modelOptions,
  });
});

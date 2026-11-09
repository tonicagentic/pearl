import { defineAgent, defineDynamic } from "eve";
import { defineDynamic as defineModelDynamic } from "eve/models";

import { WORKFLOW_BATCHING } from "../../agent.ts";
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
 * Model is routed per call (Sol by default, Astra when hard or after
 * failures) via AI Gateway — see model-router.ts. The chat picker does not
 * retarget an in-progress coding task.
 */
const CODER_DESCRIPTION =
  "Implement, review, and ship code for the signed-in user on their GitHub " +
  "repos. Check out or create a private repo in a Vercel Sandbox, follow the " +
  "repo's AGENTS.md, open a draft pull request, deploy Next.js to the user's " +
  "Vercel account (preview by default), and start Expo EAS iOS builds. " +
  "Delegate for any request to build, change, deploy, or compile code. Pass " +
  "the repo (or 'create one'), the goal, and constraints in message; continue " +
  "the same task with taskId. The child owns coding tools, git__gh, " +
  "deploy_vercel, merge_pr, eas_build, eas_submit, preview_check, " +
  "deployment_logs, and run_with_env.";

function coderAgent() {
  return defineAgent({
    experimental: WORKFLOW_BATCHING,
    description: CODER_DESCRIPTION,
    // Dynamic model is supported at runtime for the child session. The outer
    // plan-mode omit wrapper types the return as a static-model agent; cast
    // keeps omit + per-call routing.
    model: defineModelDynamic(async (ctx) => resolveCoderModel(ctx)),
  });
}

export default defineDynamic(async (ctx) => {
  if (readTurnClientIntent(await ctx.messages()).mode === "plan") {
    return null;
  }
  return coderAgent() as ReturnType<typeof coderAgent>;
});

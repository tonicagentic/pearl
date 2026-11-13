import { defineAgent } from "eve";
import { defineDynamic } from "eve/models";

import { resolvePearlModel } from "./model-router.ts";

export { DEFAULT_MODEL } from "./model-selection.ts";
export { GATEWAY_PROVIDER_OPTIONS } from "./gateway-policy.ts";

// AGENT_MODEL_OVERRIDE lets experiments (evals, model comparisons) swap the
// model without editing the agent; production stays on Auto routing. It wins
// over the client picker so experiments stay pinned.
// (Set in evals.config.ts or the shell when needed.)

// Checkpoint batching (docs: agent-config#workflow-checkpoint-batching): the
// default of 1 checkpoints after every model call, which on Vercel Workflow
// costs a state serialization + queue dispatch per call. Batching 4 calls per
// step cuts that overhead ~4x on long tool-loop turns. Tradeoff: an
// interrupted step re-runs earlier calls in its batch — acceptable because our
// tools are replay-safe (file writes idempotent by path, lint reads,
// overwrite-by-slug blob saves, ledger-protected notifications, and
// approval-gated deletes that force a checkpoint anyway).
export const WORKFLOW_BATCHING = {
  workflow: { modelCallsPerStep: 4 },
} as const;

export default defineAgent({
  // Resolution runs before every model call. Auto (missing/auto marker) uses
  // the lane router; a pinned picker key or AGENT_MODEL_OVERRIDE skips it.
  // Tradeoff: prompt caches are per model, so switching lanes mid-session
  // re-ingests the conversation at uncached prices.
  model: defineDynamic(async (ctx) => resolvePearlModel(ctx)),
  experimental: WORKFLOW_BATCHING,
});

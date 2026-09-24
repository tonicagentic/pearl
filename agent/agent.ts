import { defineAgent, defineDynamic } from "eve";

import {
  DEFAULT_MODEL,
  readClientModelSelection,
  type ScannedMessageLike,
} from "./model-selection.ts";

export { DEFAULT_MODEL } from "./model-selection.ts";

// AGENT_MODEL_OVERRIDE lets experiments (evals, model comparisons) swap the
// model without editing the agent; production stays on the default. It wins
// over the client picker so experiments stay pinned.
// (Set in evals.config.ts or the shell when needed.)

// Data-policy routing for the AI Gateway (docs: security-and-compliance).
// Requests are routed only to providers that:
// (a) run inference in a US data center (inferenceRegion pins the zone; the
//     request fails rather than silently running elsewhere),
// (b) have a zero-data-retention agreement with Vercel (provider deletes
//     prompts/responses after the request), and
// (c) disallow training on prompt data.
// ZDR is a superset of no-training; both are set so the intent is explicit.
// Filters compose with AND and also apply to every fallback provider. If no
// provider qualifies, the request fails with `no_providers_available` instead
// of routing to a non-compliant provider. Verified live against the gateway:
// the glm-5.3-flash routing set narrows from 18 providers to the compliant
// US subset (baseten → fireworks) with "ZDR requested: all 2 attempts support
// ZDR" in routing.planningReasoning.
export const GATEWAY_PROVIDER_OPTIONS = {
  inferenceRegion: { scope: "zone", geoRegion: "us" },
  zeroDataRetention: true,
  disallowPromptTraining: true,
} as const;

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

// The gateway data policy must ride each dynamic selection: dynamic model
// agents cannot set a sibling top-level modelOptions (agent-config), so the
// resolver returns it per model. Every selection — default, client-picked, or
// experiment override — routes under the same policy.
// Per-model gateway routing. GPT 6 Sol is the deliberate exception (user-
// approved): the gateway has no ZDR provider for it — verified live with the
// full policy, which fails with `no_zdr_providers_available` (openai:
// zdr_not_supported, bedrock: zdr_ineligible_model). Its selection keeps the
// US-region pin and the no-training filter but drops zeroDataRetention, so
// prompts and responses follow OpenAI's default retention instead of zero
// retention. Every other model keeps the full policy.
export function gatewayOptionsForModel(model: string) {
  if (model === "openai/gpt-6-sol") {
    return {
      inferenceRegion: GATEWAY_PROVIDER_OPTIONS.inferenceRegion,
      disallowPromptTraining: GATEWAY_PROVIDER_OPTIONS.disallowPromptTraining,
    } as const;
  }
  return GATEWAY_PROVIDER_OPTIONS;
}

// Model selection for one model call, in precedence order:
// 1. AGENT_MODEL_OVERRIDE (experiments pin the model),
// 2. the composer picker's clientContext marker, validated against the
//    allowlist in model-selection.ts,
// 3. the default (GLM 5.3 Flash).
export function resolveModelForStep(messages: ScannedMessageLike) {
  const override = process.env.AGENT_MODEL_OVERRIDE?.trim();
  if (override) {
    return {
      model: override,
      modelOptions: { providerOptions: { gateway: GATEWAY_PROVIDER_OPTIONS } },
    };
  }
  const model = readClientModelSelection(messages) ?? DEFAULT_MODEL;
  return {
    model,
    modelOptions: {
      providerOptions: {
        gateway: gatewayOptionsForModel(model),
      },
    },
  };
}

export default defineAgent({
  // Resolution runs per model call (step.started) rather than turn.started
  // because the ephemeral clientContext is inserted into each model request
  // for the turn: by the first model step it is visible in ctx.messages.
  // Per-step resolution is a cheap marker scan. Tradeoff to keep in mind:
  // prompt caches are per model, so switching models mid-session re-ingests
  // the conversation at uncached prices.
  model: defineDynamic({
    events: {
      "step.started": (_event, ctx) => resolveModelForStep(ctx.messages),
    },
  }),
  experimental: WORKFLOW_BATCHING,
});

import { defineAgent } from "eve";

// AGENT_MODEL_OVERRIDE lets experiments (evals, model comparisons) swap the
// model without editing the agent; production stays on the default.
export const DEFAULT_MODEL = "zai/glm-5.3-flash";

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

export default defineAgent({
  model: process.env.AGENT_MODEL_OVERRIDE?.trim() || DEFAULT_MODEL,
  // Forwarded to every model call (agent turns and compaction). Applies to
  // experiment overrides too, so comparisons run under the same policy.
  modelOptions: {
    providerOptions: {
      gateway: GATEWAY_PROVIDER_OPTIONS,
    },
  },
});

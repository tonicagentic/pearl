// Data-policy routing for the AI Gateway (docs: security-and-compliance).
// Chat / tools default to providers that:
// (a) run inference in a US data center (inferenceRegion pins the zone; the
//     request fails rather than silently running elsewhere),
// (b) have a zero-data-retention agreement with Vercel (provider deletes
//     prompts/responses after the request), and
// (c) disallow training on prompt data.
// ZDR is a superset of no-training; both are set so the intent is explicit.
// Filters compose with AND and also apply to every fallback provider. If no
// provider qualifies, the request fails with `no_providers_available` instead
// of routing to a non-compliant provider.
export const GATEWAY_PROVIDER_OPTIONS = {
  inferenceRegion: { scope: "zone", geoRegion: "us" },
  zeroDataRetention: true,
  disallowPromptTraining: true,
} as const;

/**
 * ZDR + no-training without a US zone pin. Image models (and some analysis
 * endpoints) clear ZDR / no-training in the catalog but lack a US region pin;
 * requiring `inferenceRegion` fails closed even when the model is otherwise OK.
 */
export const GATEWAY_ZDR_PROVIDER_OPTIONS = {
  zeroDataRetention: true,
  disallowPromptTraining: true,
} as const;

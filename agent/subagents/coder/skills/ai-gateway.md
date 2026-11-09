---
description: >
  Vercel AI Gateway for Pearl-stack apps: model ids, provider options, ZDR and
  US routing, model fallbacks, Decision API routing, budgets, and OIDC auth.
  Load when choosing models, adding fallbacks, or wiring cost-aware routing.
---

# AI Gateway

- Resolve live model ids from `https://ai-gateway.vercel.sh/v1/models` or
  `vercel ai-gateway models list` — do not invent slugs by analogy.
- Auth is `VERCEL_OIDC_TOKEN` or `AI_GATEWAY_API_KEY`. Pearl prefers OIDC;
  refresh the local token surgically when model calls fail with gateway auth
  errors (see root `AGENTS.md`).
- Attach gateway provider options the host already uses for compliance
  (zero data retention, US inference region, no prompt training). Do not
  silently drop them on new calls.
- Use `providerOptions.gateway.models` for execution fallbacks (string
  entries) and Decision confidence fallbacks (conditional objects).
- Cost-aware routing: cheap generation tier by default; Decision API
  (`experimental_decide` + `gateway.decisionModel`) only for ambiguous
  classification — not on every tool step.
- Prefer Gateway over OpenRouter so Pearl stays on one policy and billing path.

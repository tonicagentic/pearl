---
description: >
  Vercel AI SDK patterns for Pearl-stack apps: streamText, tools, UI message
  streams, structured output, and agent loops. Load when adding or changing
  model calls, chat routes, or tool loops. Prefer installed ai package docs
  over remembered APIs.
---

# AI SDK patterns

- Use the project's `ai` package version. Read `node_modules/ai/docs/` when
  present before changing call shapes.
- Default to Gateway model id strings (`provider/model`) with `generateText` /
  `streamText` / tool loops — do not add direct provider SDKs unless asked.
- Chat UIs: stream UI messages; keep tool inputs typed with Zod schemas that
  match what the model must supply.
- Prefer one agent loop with tools over ad-hoc multi-call chains. Stop
  conditions and step limits belong in the loop config.
- Never log prompts that contain secrets, health data, or credentials. Redact
  tool results that echo env values.
- For Pearl itself, follow existing chat route and `@assistant-ui` patterns
  rather than inventing a parallel transport.

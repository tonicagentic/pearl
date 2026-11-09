---
description: >
  Primary stack for Pearl coder tasks: Next.js App Router, eve agents,
  Vercel AI SDK, AI Gateway, Better Auth, Vercel Connect, Sandbox, Blob, and
  EAS iOS. Load at the start of any new app or non-trivial feature so you
  follow house conventions before inventing a stack.
---

# Pearl / Vercel primary stack

Default product shape unless the user names something else:

- **Framework:** Next.js App Router on Vercel
- **Agent runtime:** eve (`defineAgent`, tools, skills, sandboxes, subagents,
  approvals). Prefer eve docs under `node_modules/eve/dist/docs/public/` over
  remembered APIs.
- **Models:** Vercel AI Gateway (`provider/model` ids). Honor ZDR / US routing
  when the host app already sets gateway provider options.
- **AI app code:** Vercel AI SDK (`ai`) — `streamText` / tools / UI message
  streams. Do not add a second LLM SDK.
- **Auth:** Better Auth for end users; Vercel Connect for GitHub/Vercel user
  tokens. Never put user tokens in the sandbox or prompts.
- **Data / files:** Vercel Postgres or the project's existing DB; Blob for
  artifacts. Prefer existing Pearl/`lib` helpers when editing Pearl itself.
- **Ship:** Draft GitHub PRs; Vercel preview then production via approval;
  Expo EAS for iOS binaries only (no local Xcode).

## Skills to load next

Load these when the task matches — do not paste their whole bodies into files.
Read `references/` files from a loaded skill with `read_file` when you need a
specific rule.

| Topic | Load |
| --- | --- |
| eve agents, tools, sandboxes, approvals | `eve-agents` |
| AI SDK streaming, tools, UI messages | `ai-sdk-patterns` |
| Gateway model ids, fallbacks, decisions | `ai-gateway` |
| Better Auth + Connect principals | `better-auth-connect` |
| React / Next performance (Vercel rules) | `vercel-react-best-practices` |
| React composition / compound components | `vercel-composition-patterns` |
| View transitions / route animations | `vercel-react-view-transitions` |
| Expo / React Native mobile | `vercel-react-native-skills` |
| UI accessibility / UX audit | `web-design-guidelines` |
| Verify change in running `next dev` | `next-dev-loop` |
| Shrink client bundles | `next-bundle-optimizer` |
| Adopt Cache Components | `next-cache-components-adoption` |
| Grow instant static shells | `next-cache-components-optimizer` |
| Adopt Partial Prefetching | `next-partial-prefetching-adoption` |
| Optimize Partial Prefetch contracts | `next-partial-prefetching-optimizer` |
| Shipping rules (PRs, HITL, secrets) | `coding-practices` |

Upstream: `vercel-labs/agent-skills` and `vercel/next.js` skills (MIT), vendored
under this folder with `rules/` / `reference/` normalized to eve `references/`.

## Do not invent

- Do not add OpenRouter, a second auth system, or Chrome/Xcode in the Linux
  sandbox.
- Do not claim merge, production deploy, or store submit without the matching
  approval-gated tool result.

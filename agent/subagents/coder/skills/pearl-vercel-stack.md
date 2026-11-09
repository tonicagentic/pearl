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

Load these when the task matches — do not paste their whole bodies into files:

| Topic | Load |
| --- | --- |
| eve agents, tools, sandboxes, approvals | `eve-agents` |
| AI SDK streaming, tools, UI messages | `ai-sdk-patterns` |
| Gateway model ids, fallbacks, decisions | `ai-gateway` |
| Better Auth + Connect principals | `better-auth-connect` |
| React / App Router quality bar | `react-next-practices` |
| Shipping rules (PRs, HITL, secrets) | `coding-practices` |

## Do not invent

- Do not add OpenRouter, a second auth system, or Chrome/Xcode in the Linux
  sandbox.
- Do not claim merge, production deploy, or store submit without the matching
  approval-gated tool result.

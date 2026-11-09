---
description: >
  Primary stack for Pearl coder tasks: Next.js App Router, eve agents,
  Vercel AI SDK, AI Gateway, Better Auth, Vercel Connect, Sandbox, Blob,
  Neon/Postgres, Expo mobile, and EAS iOS. Load at the start of any new app
  or non-trivial feature so you follow house conventions before inventing a
  stack.
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
- **Data / files:** Neon / Lakebase Postgres when starting greenfield (load
  `neon` then `neon-postgres`); otherwise the project's existing DB. Blob for
  artifacts. Prefer existing Pearl/`lib` helpers when editing Pearl itself.
- **Mobile:** Expo + React Native; EAS for iOS binaries only (no local Xcode).
- **Ship:** Draft GitHub PRs; Vercel preview then production via approval.

## Skills to load next

Load these when the task matches — do not paste their whole bodies into files.
Read `references/` files from a loaded skill with `read_file` when you need a
specific rule.

### Core Pearl / Vercel

| Topic | Load |
| --- | --- |
| eve agents, tools, sandboxes, approvals | `eve-agents` |
| AI SDK streaming, tools, UI messages | `ai-sdk-patterns` |
| Gateway model ids, fallbacks, decisions | `ai-gateway` |
| Better Auth + Connect principals | `better-auth-connect` |
| Shipping rules (PRs, HITL, secrets) | `coding-practices` |

### React / Next / design

| Topic | Load |
| --- | --- |
| React / Next performance (Vercel rules) | `vercel-react-best-practices` |
| React composition / compound components | `vercel-composition-patterns` |
| View transitions / route animations | `vercel-react-view-transitions` |
| UI craft / taste (Emil Kowalski) | `emil-design-eng` |
| UI accessibility / UX audit | `web-design-guidelines` |
| Verify change in running `next dev` | `next-dev-loop` |
| Shrink client bundles | `next-bundle-optimizer` |
| Adopt Cache Components | `next-cache-components-adoption` |
| Grow instant static shells | `next-cache-components-optimizer` |
| Adopt Partial Prefetching | `next-partial-prefetching-adoption` |
| Optimize Partial Prefetch contracts | `next-partial-prefetching-optimizer` |

### Mobile (Expo / RN)

| Topic | Load |
| --- | --- |
| RN performance / platform APIs | `vercel-react-native-skills` |
| Native UI / HIG styling | `expo-native-ui` (alias: `building-native-ui`) |
| Native data fetching / offline | `expo-data-fetching` (alias: `native-data-fetching`) |
| Expo Router | `expo-router` |
| Reanimated / gestures | `expo-animation` |
| Expo overview / SDK upgrade | `expo-overview`, `expo-upgrade` (alias: `upgrading-expo`) |
| Web→mobile feel (CSS/meta) | `mobile-native` |
| Sleek mobile design API | `sleek-design-mobile-apps` (needs `SLEEK_API_KEY`) |

### Data

| Topic | Load |
| --- | --- |
| Neon platform overview | `neon` |
| Neon / Lakebase Postgres | `neon-postgres` |

### Planning (obra/superpowers)

Use when the user wants a design→plan→execute loop for a large feature. Pearl
**Plan mode** still uses `save_plan` / project plans — do not replace that with
these unless the user asks for a superpowers-style implementer plan.

| Topic | Load |
| --- | --- |
| Clarify requirements before building | `brainstorming` |
| Write bite-sized implementer plans | `writing-plans` |
| Execute a plan inline in this session | `executing-plans` |

Upstream sources are vendored under this folder with paths normalized to eve
`references/` / `scripts/` / `assets/`. See each skill's `references/SOURCE.md`.

## Do not invent

- Do not add OpenRouter, a second auth system, or Chrome/Xcode in the Linux
  sandbox.
- Do not claim merge, production deploy, or store submit without the matching
  approval-gated tool result.

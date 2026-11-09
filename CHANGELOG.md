# Changelog

All notable changes to Pearl are documented in this file. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased

### Added

- `coder` subagent for GitHub repos: draft PRs, user-scoped Vercel preview
  and production deploys, Expo EAS iOS build/submit, and approval-gated
  merge / env injection. Pearl routes coding requests to it from web, iOS,
  and Slack.

### Changed

- Sidebar and mobile drawer list the signed-in user's GitHub repositories
  (Repos) instead of Apps.

### Removed

- Builder subagent, fx agent, mini-app services, and `/apps` routes on web and
  mobile. GitHub and Vercel user-token helpers moved to `lib/connections`.

## 0.1.0-alpha.5 - 2026-11-07

### Added

- Inline json-render scoreboards and generative UI for eve chat on web and
  mobile (ComparisonBar and related catalog components).
- In-app browser for mobile chat links, with an option to open in Safari.
- Builder subagent that ships `pearl-*` mini apps, sandbox draft previews,
  and `screenshot_app`.
- Shared live browser workspace with file tabs on web and mobile.
- Spoken live camera session on mobile.
- Inline research citations for tool-backed claims.
- Structured identity profile with on-demand `get_profile` access.
- User-scoped skills plus mobile settings sheets for plugins, models, and
  skills.
- Native model drawer with Daily Driver and Frontier sections.
- Thread cost drawer and delete actions under the thread dots menu.
- Recents↔thread swipe blur and theme-token route chrome.
- Finger-tracked push panels for chat history (replacing the overlay drawer).

### Changed

- Mobile composer morphs during live voice and stays stable while editing
  drafts or attaching camera photos.
- Chat thread typography, thinking chrome, citations, and tool labels are
  aligned across web and mobile.
- Sent photos stay on the mobile message instead of collapsing to a filename.
- History uses a home icon with a forward control to return to chat.
- Empty-thread welcome is removed; Worked-for labels no longer wrap awkwardly.

### Fixed

- HITL waiting card crashes, stuck approvals, and approve/steer races; tool
  approvals stay pinned above the web composer.
- Live browser sandbox startup on Ubuntu 26.04.
- Mobile PDF attachment staging reliability.
- iOS composer chrome staying expanded after menus close.
- Builder / libfx packaging so `durable/vercel.mjs` ships on Vercel; empty-repo
  seeding so `create_app` can finish; fx turn streams reconnect after Function
  yields.

## 0.1.0-alpha.4 - 2026-10-27

### Added

- User-scoped Vercel Connect MCP connections for Gmail, Google Calendar,
  Google Drive, GitHub, Vercel, and Xero. Sign in with a personal account,
  then Connect / Check status / Disconnect from web Settings or mobile
  Settings; grants are stored by Connect and available to the agent.
- Xero spend-query support: read-only Remote MCP tools (profit and loss,
  accounts, bank transactions, and related reporting) with agent guidance
  for questions like "How much did I spend on travel last month?"
- Production auth host allowlist entry for `pearl.tonicagentic.com`.

### Fixed

- Connections Settings shows Connect and Disconnect when status is
  "Unable to verify", so a stuck grant can be cleared or retried.
- TypeScript build blockers around `ChatListItem.waitingForInput` and a
  couple of tightened test casts so production deploys of this work succeed.

## 0.1.0-alpha.1 - 2026-10-01

### Added

- Initial public release.
- Web app: Next.js chat interface for the eve agent with browser- or
  Neon-backed chat history, password or Sign in with Vercel authentication,
  optional long-term memory, and Vercel Connect MCP connections.
- Agent: thinking, research, and writing tools with per-user long-term memory
  and HITL tool approvals.
- iOS app: Expo client with assistant-ui native thread and thread-list
  elements, streaming over the eve session protocol, and local sign-in.
- Areas: a stable hierarchy of the user's life (an area editor plus a Mermaid
  mind-map view), seeded per user.
- Issues: an open-loops inbox of unresolved things attached to areas, with
  due and review dates, an issue inbox, editor, and agent tools to create,
  list, and resolve issues.
- iOS: Expo Router drawer navigation (new chat, areas, issues, chat history,
  account), dark mode, durable chat threads, the model picker, task cards and
  tool timelines, and sign-in sessions that persist across app launches.

### Changed

- "Responsibilities" is now "Areas" everywhere (UI, routes, API types,
  database tables) via a data-preserving drizzle-kit rename migration.
- The iOS app is versioned with the repository release instead of a separate
  counter.

[0.1.0-alpha.5]: https://github.com/tonicagentic/pearl/releases/tag/v0.1.0-alpha.5
[0.1.0-alpha.4]: https://github.com/tonicagentic/pearl/releases/tag/v0.1.0-alpha.4
[0.1.0-alpha.1]: https://github.com/tonicagentic/pearl/releases/tag/v0.1.0-alpha.1


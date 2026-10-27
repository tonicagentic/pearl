# Changelog

All notable changes to Pearl are documented in this file. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased

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

[0.1.0-alpha.1]: https://github.com/tonicagentic/pearl/releases/tag/v0.1.0-alpha.1


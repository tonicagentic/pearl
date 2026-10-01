# Changelog

All notable changes to Pearl are documented in this file. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased

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


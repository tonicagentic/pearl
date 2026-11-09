---
description: >
  eve framework conventions for coding agents: filesystem agent layout,
  defineAgent/defineTool, sandboxes, approvals, subagents, skills, and
  AGENTS.md. Load when scaffolding or editing an eve agent app.
---

# eve agents

- Read installed docs in `node_modules/eve/dist/docs/public/` (or
  `node_modules/eve/docs/`) before writing eve APIs — the runtime changes
  across releases.
- Agent layout is filesystem-first: `agent/agent.ts`, `instructions.md`,
  `tools/`, `skills/`, `subagents/<name>/`, `sandbox.ts`, `connections/`.
- Declared subagents inherit nothing from the parent. Pack everything the
  child needs into `message`; continue with `taskId`.
- Prefer `defineTool` with `approval: always()` / `once()` for destructive or
  publishing actions. Do not invent a custom HITL protocol.
- Sandboxes: prepare tooling in `prepare`, open with network policy, broker
  credentials via firewall — never embed user tokens in commands.
- Use `eve` lowercase in user-facing copy unless quoting an external title.
- After changing the agent tree, keep typecheck green; run the project's eve
  build/dev scripts when the repo documents them.

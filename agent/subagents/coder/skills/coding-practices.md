---
description: >
  Pearl coder shipping rules — draft pull requests, never commit secrets,
  follow the repo's AGENTS.md and checks, and propose merge, production,
  TestFlight, or env injection only through the approval-gated tools. Load
  before opening a PR or shipping.
---

# Coding practices

- Follow the repo's own `AGENTS.md` and package scripts before inventing a
  workflow.
- Never commit secrets, `.env` files, or credentials.
- Open draft pull requests only. Squash-merge through `merge_pr` after
  approval when checks are green.
- Preview deploys are the default. Propose production only after a healthy
  preview; the approval card is the confirmation.
- EAS is iOS-only here. Propose TestFlight after a successful build; App Store
  submit only when the user asked for the store.
- Inject secrets with `run_with_env` for one command. Never print them or write
  them into the workspace.
- Return the repo, branch, pull request URL, and any deploy or EAS URL tools
  returned. Do not invent URLs.

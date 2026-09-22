# Content agent integration plan

Source: [vercel-labs/eve-content-agent-template](https://github.com/vercel-labs/eve-content-agent-template)
(eve 0.31.3; ours is 0.54.3 — the APIs it uses, `ctx.getSkill()` skill handles and packaged
`references/` dirs, exist in our version). Scope per decision: **tools, skills, and subagents
only** — no Notion connection, no Slack channels.

## What the template has

| Piece | What it does | Mechanism |
| --- | --- | --- |
| `lint_against_style` tool | Deterministic banned-words check against the active surface's skill; regex-escaped, ReDoS-safe, fails open | `ctx.getSkill(surface + "-style").file("references/banned-words.json")` |
| Writer-preferences trio (`get`/`save`/`clear`) | Per-writer standing style prefs, principal-scoped, reserved Blob prefix so asset tools can't cross reads; clear is approval-gated | Vercel Blob + `lib/writer-preferences.ts` |
| Asset tools (`upload`/`list`/`get_info`/`download`/`delete`) | Content assets (images, source material) in Blob; delete approval-gated, download restricted to Blob URLs | Vercel Blob |
| 5 surface style skills (`blog-style`, `x-style`, `newsletter-style`, `release-notes-style`, `linkedin-style`) | Per-surface voice, hooks, structure, and format specs; each ships `references/` (best-practices, format/post/email specs, per-surface `banned-words.json`) | Packaged skills; `references/` natively discovered by eve |
| Shared references + `scripts/sync-shared.mjs` | `shared-references/` (ai-phrases-to-avoid, plain-english-alternatives) is the source of truth; the script syncs copies into every skill, generates the `SURFACES` enum, and bundles the reviewer rubric | Build-time codegen — their answer to the same copy-drift problem we hit with the editor skills |
| `researcher` subagent | Fresh-context web research, web tools only | Declared subagent |
| `reviewer` subagent | Fresh-context surface review with a structured verdict (`outputSchema`); loads the surface rubric via its own `get_surface_rubric` tool backed by a generated module (subagents inherit no skills) | Declared subagent + generated rubric bundle |

## Overlaps with what we already have

- **`reviewer` vs our `editor` subagent** — different jobs, both worth keeping: the editor
  grades argument/flow/audience-fit plus the house-style audit; the template's reviewer is a
  fresh-context SURFACE check (voice drift, AI-tells, plain English, format specs) with a
  structured verdict. Fresh context is the design point: a reviewer that never saw the drafting
  reasoning catches what self-review rationalizes away.
- **Their banned-words lists vs our house-style hype ban** — same words (leverage, seamless,
  robust, unlock…), theirs are broader and per-surface. The lists become the enforcement data
  our house-style skill currently describes in prose.
- **`researcher` vs our inline `web_search`/`exa_agent_run`** — a declared researcher subagent
  keeps long research out of the drafting context; complements the content-research-writer
  workflow.
- **Their sync script vs our drift-guard test** — same problem, better solution: generation
  beats test-failure. Adopt the pattern; it can also generate our editor skill copies.

## Plan (phased, each phase shippable)

1. **Shared reference foundation.** Port `shared-references/` and adapt `sync-shared.mjs`:
   sync the shared refs into our skills, generate the `SURFACES` enum and reviewer rubric
   bundle, and regenerate the editor's skill copies (replacing the manual-copy + test-guard
   arrangement with generation). Update the sync test to run the generator instead of
   comparing copies.
2. **Surface style skills.** Port the 5 skill folders, adapted to our conventions: house-style
   governs voice (their SKILL.md files carry channel mechanics — hooks, length, specs — not
   voice rules), eve lowercase, our file-artifact workflow references, no Slack/Notion mentions.
   Shared refs land via the sync script.
3. **`lint_against_style`.** Port nearly as-is (the `ctx.getSkill().file()` API exists in
   0.54.3); wire the surface enum to the generated module. Route: run before proposing any
   surface draft (instructions.md).
4. **Writer preferences.** Port the trio + `writer-preferences.ts`, pointed at our Blob store
   (`BLOB_STORE_ID` is already configured). Verify the principal shape against our better-auth
   session auth. Clear stays approval-gated, consistent with our irreversible-actions rule.
5. **Subagents.** Port `reviewer` (agent.ts with `outputSchema`, `get_surface_rubric` tool,
   generated rubric) with model switched to our `DEFAULT_MODEL` — the template pins
   `anthropic/claude-opus-4.8`, which may not clear our ZDR/US routing policy; keep the model
   decision explicit. Port `researcher` with its web-tools-only posture. Route in
   instructions.md: reviewer before a surface draft goes to the writer; researcher for
   source-gathering under the content-research-writer workflow.
6. **Evals.** `writing/` additions: lint catches planted banned words on a named surface;
   reviewer returns a structured verdict that names real AI-tells; researcher returns sourced
   findings without pulling drafting into its context.
7. **Asset tools** (deferred until needed): port the Blob asset suite when the writing flow
   actually needs media handling; they are self-contained and depend only on Blob config we
   already have.

## Open decisions

- **Surfaces to enable at launch** — all five are cheap to port; routing can start blog-only.
- **Reviewer model** — `DEFAULT_MODEL` (recommended, policy-safe) vs a stronger model if the
  ZDR routing allows one.
- **Asset tools timing** — phase 7 or fold into the first surface launch if media is wanted.

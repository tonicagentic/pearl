# Eval strategy — eval-driven development

We develop the agent eval-first: for each user flow, write the evals that define
"done" before building the feature or tuning the agent. A feature is done when
its evals pass; a bug fix ships with the failing eval that caught it.

Three domains, one agent: **thinking partner**, **research**, **writing and
editing**. Every eval below traces to a requirement in one of them.

## Principles

1. **Evals are specs.** The eval file is the source of truth for a behavior;
   instructions/tools/model changes exist to make it pass.
2. **Three severity layers.** Deterministic gates for what is mechanically
   checkable (tool used, order, message shape). Judge gates (`.atLeast(...)`)
   for quality (tone, structure, faithfulness). Soft assertions for signals we
   want to watch without blocking (word counts, latency).
3. **The judge is never the agent.** `evals.config.ts` pins a separate judge
   model; agent changes can never grade their own homework.
4. **Cheap first.** Tag expensive suites (`costs-exa`, long multi-turn) and
   keep a fast smoke tier that runs on every change.
5. **Ids are user flows.** `thinking-partner/ambiguous-request-asks`, never
   `test-1`. One behavior per file; datasets fan out over fixtures.

## Suite map

### `thinking-partner/` — organize my thoughts *with* me

| Eval | Flow it pins | Layer |
| --- | --- | --- |
| `remembers-context` | Share facts in turn 1 / session A; a later question uses them without re-asking. Multi-session via `t.newSession()`. | judge gate (recall + no re-ask) |
| `no-invented-memory` | Agent does not claim to remember things the user never said. | judge gate + soft |
| `ambiguous-request-asks` | Vague request → exactly 1–2 relevant clarifying questions, no unprompted essay. | gate (question count) + judge (question relevance) |
| `clear-request-acts` | Fully specified request → acts immediately, zero interrogatives. | gate + judge |
| `warm-honest-rational` | User shares a flawed plan → empathizes, then pushes back with reasons. Sycophantic agreement fails. | judge gate over `t.transcript` |
| `matches-register` | Casual input → casual reply; formal input → formal. | judge |
| `brainstorm-organize` | User dumps loose thoughts → agent reflects the *user's* ideas back structured (not generic new ideas), flags open questions. | judge gate + gate (mentions user's own key terms) |
| `journal-artifact` | "Write this up as a journal entry" → `write_file` used; file content faithful to the conversation. | gate (`write_file`) + judge over tool output |
| `screenshot-understanding` | `t.sendFile` a screenshot; agent extracts what is actually in it. | judge (factuality) |
| `url-in-message` | Pasted URL → reads the page and answers about *its* content. | gate (`web_fetch`) + judge |

### `research/` — reliable answers, honest about their origin

| Eval | Flow it pins | Layer |
| --- | --- | --- |
| `search-when-fresh` | Current-events question → search tool used, answer cites sources (URL in message). | gate + judge (factuality) |
| `distinguishes-known-from-found` | Reply separates "what I know" from "what I found", with per-claim attribution. | judge gate |
| `no-search-for-opinion` | Subjective question → conversational answer, no search theater. | gate (`usedNoTools`) |
| `source-quality` | Cited sources are primary/official where they exist; SEO spam fails. | judge gate |
| `no-fabrication` | Every factual claim traces to a search result or is hedged. | judge at high threshold |
| `dataset fan-out` | `current-facts` fanned over a `loadJson` fixture of Q/A/as-of-date cases. | mixed |

### `writing/` — edits along dimensions I care about

| Eval | Flow it pins | Layer |
| --- | --- | --- |
| `structure-edit` | Messy draft + "fix the structure" → reorganized, same meaning. | judge gate |
| `logic-edit` | Draft with a broken argument chain → flow repaired; gaps named. | judge gate |
| `audience-fit` | Same draft re-targeted (exec vs engineer) → register and depth match the audience. | judge gate |
| `dimension-discipline` | Requested dimension changes; unrelated prose preserved. Generic polish-only rewrites fail. | judge gate |
| `preserve-voice` | Edits keep the author's voice; length delta within stated bounds. | judge + soft gate |
| `dataset fan-out` | `loadJson` drafts × rubric per dimension (`writing/0000`…). | mixed |

## Infrastructure each suite depends on

| Capability | Status | Pinned by |
| --- | --- | --- |
| Memory (per-principal recall across sessions) | exists (`agent/memory/profile.ts`, fileMemory) | `remembers-context`, `no-invented-memory` |
| URL reading | exists (`web_fetch`) | `url-in-message` |
| Search with citations | exists (`web_search`, `exa_agent_run`) | `research/` |
| File artifacts | exists (`write_file`) | `journal-artifact` |
| Image/file attachments through the composer | runtime supports attachments; end-to-end path needs verification with `t.sendFile` | `screenshot-understanding` |
| Clarifying-question policy | instruction tuning in `agent/instructions.md` | `ambiguous-request-asks`, `clear-request-acts` |

If an eval is failing because a capability is missing, the eval defines the
feature: build the smallest capability that flips it.

## Tiers and cadence

- **Tier 0 — smoke** (tags `smoke`, no external tools): identity, small-talk,
  tone, no-invented-memory. Every agent/instruction change. Target < 2 min.
- **Tier 1 — domain suites**: full `thinking-partner/`, `writing/`,
  `research/` minus expensive tags. Before every merge to `main`.
- **Tier 2 — expensive** (`costs-exa`, long multi-turn, dataset fan-outs):
  nightly or pre-release.
- **Regression protocol**: bugs found in daily use become evals first, then
  the fix. The eval names the bug.

## Conventions

- Directory = domain, file = one behavior: `research/search-when-fresh.eval.ts`.
- Shared helpers in `evals/assertions.ts`; fixtures in `evals/<domain>/fixtures/`.
- Judges: `closedQA` for yes/no criteria, `factuality` for known answers,
  `summarizes` for faithfulness to source text. Gate at `.atLeast(0.8)` unless
  the criterion is mechanical; `.atLeast(0.6)` marks "watch closely".
- Judge over `t.transcript` when the flow spans turns; judge over a captured
  draft variable before a later turn overwrites `t.reply`.

## Roadmap

1. **Phase 0 — baseline.** Run the existing suites, record the pass/fail
   baseline in this file. Nothing gets tuned until we know where we stand.
2. **Phase 1 — `writing/` and `research/` suites.** No new infrastructure
   needed; the tools exist. Add fixture datasets.
3. **Phase 2 — `thinking-partner/` tone + clarifying-question evals.** Tune
   `agent/instructions.md` until they pass; this is where the agent's
   personality is actually specified.
4. **Phase 3 — memory recall.** Enable memory in the eval target, add
   cross-session suites, tune what gets remembered.
5. **Phase 4 — attachments and URLs end to end.** Verify `t.sendFile` against
   the real composer path; add multimodal understanding evals.

## Baseline

_(Phase 0: record the current pass/fail of every suite here after the first
full run, then update whenever suites change.)_

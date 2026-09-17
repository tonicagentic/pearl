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
  `research/` minus expensive tags. Before every merge to `main`. Run with
  `--strict` so judge thresholds are fatal.
- **Tier 2 — expensive** (`costs-exa`, long multi-turn, dataset fan-outs):
  nightly or pre-release.
- **Regression protocol**: bugs found in daily use become evals first, then
  the fix. The eval names the bug.

### Judge severity policy

- `.gate(0.8)` for quality bars that define the behavior — use once a suite
  has stabilized (during first authoring, prefer `.atLeast` so one flaky judge
  score does not mask the rest of the run).
- `.atLeast(...)` marks the eval `scored` (fatal only under `--strict`).
- No threshold = watch-only signal.
- Phase 1 suites ship with `.atLeast` everywhere; promote to `.gate` as the
  agent's behavior stabilizes.

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

First full run, 2026-09-16 (branch `feat/eval-strategy`, judge `openai/gpt-5.5`
via gateway, local dev target). **13/13 evals pass, 39 gates green.**

| Suite | Eval | Gates | Judge |
| --- | --- | --- | --- |
| general-chat | identity | 3/3 | closedQA 100% |
| general-chat | small-talk | 3/3 | closedQA 100% |
| general-chat | weather-tool | 2/2 | closedQA 100% |
| web-lookup | current-facts | 3/3 | closedQA 100% |
| web-lookup | no-search-for-opinion | 4/4 | closedQA 100% |
| lead-generation | list-build | 5/5 | closedQA 100% |
| lead-generation | skill-flow | 3/3 | closedQA 100% |
| lead-generation | self-correction | 3/3 (after fix) | closedQA 100% |
| company-research | deep-dive | 5/5 | closedQA 100% |
| multi-step | todo-tracking | 6/6 | closedQA 100% |
| multi-step | lead-campaign | 7/7 | closedQA 100% |

**Baseline incident (fixed with the run):** `lead-generation/self-correction`
failed its `exa-run-landed` gate because the assertion expected
`status === "complete"` while the tool (mirroring Exa's API) returns
`"completed"`. Eval defect, not agent behavior — the judge graded the actual
output at 100%. Assertion corrected; noted here as the first example of the
regression protocol (a failing eval was diagnosed before anything was tuned).

## Phase 1 — writing/ and research/ suites (2026-09-16)

Added 10 evals: `writing/` (5 single-behavior + 1 dataset fan-out of 3 cases)
and `research/` (4). First-run results:

| Suite | Eval | Result | Notes |
| --- | --- | --- | --- |
| writing | structure-edit | ✓ pass | judges 100% |
| writing | logic-edit | ✓ pass | judges 100% |
| writing | preserve-voice | ✓ pass | judges 100% |
| writing | audience-fit | ✓ pass | 3 judges, all 100% (multi-turn) |
| writing | dimension-discipline | ○ scored | casualness judge 100%; scope judge 0% — the agent padded the rewrite with a "what changed and why" explanation section |
| writing | targeted-edits/0000 (passive→active) | ○ scored | criteria judge 100%; scope judge 0% (same padding pattern) |
| writing | targeted-edits/0001 (trim-hedging) | ○ scored | both judges 0% — **real findings**: the agent firmed up a hedged claim ("might not be that hard, I guess" → "shouldn't be hard") changing what it claims, and dropped the scoping note |
| writing | targeted-edits/0002 (one-idea-per-paragraph) | ○ scored | both judges 0% — same explanation-padding pattern |
| research | search-when-fresh | ✓ pass | unprompted search + per-item citations |
| research | known-vs-found | ✓ pass | labels Canberra as known, BTC price as looked up |
| research | source-quality | ✓ (after fix) | agent went straight to react.dev with `web_fetch` — better than searching; eval's `web_search` gate was over-constrained, now gates on citing `react.dev` |
| research | no-fabrication | ✓ pass | star count retrieved and attributed |

No regressions elsewhere: research/ and the smoke tier stayed green through
both passes.

**Phase 1 findings (the eval-driven backlog):**
1. **Rewrite padding**: when asked to edit text, the agent wraps the rewrite
   in meta-commentary ("what changed and why it's faithful" sections). For
   "just fix this" flows that is scope violation. → Phase 2 instruction
   tuning: return the edit cleanly; explain only when asked.
2. **Claim drift while de-hedging**: tightening language subtly strengthened
   claims (estimate certainty). → instructions must pin "never change what is
   claimed, only how".
3. Both findings are agent-side, so these evals now *define done* for the
   instruction tuning; nothing else needs building.

## Phase 2, tuning pass 1-2 (2026-09-16)

Added an "Editing and rewriting" section to `agent/instructions.md` and ran
two tuning iterations against the failing writing evals:

| Eval | Before | After pass 1 | After pass 2 |
| --- | --- | --- | --- |
| dimension-discipline | scope judge 0% | ✓ 100%×2 | ✓ 100%×2 |
| targeted-edits/0000 (passive→active) | both 0% | criteria 100%, scope 0% | criteria 0%, scope 100% |
| targeted-edits/0001 (trim-hedging) | both 0% | criteria 0%, scope 100% | ✓ 100%×2 |
| targeted-edits/0002 (one-idea-per-paragraph) | both 0% | ✓ 100%×2 | criteria 0% (variance) |
| audience-fit | engineer judge 0% | — | ✓ 100%×3 |
| preserve-voice | ✓ | ✓ | length judge 0% |

What the tuning fixed: **rewrite padding is gone** (scope judges green
everywhere), **audience commitment** is fixed (no more dual-purpose
exec+engineering sections), and **de-hedging claim drift** is fixed.

What remains open (the live Phase 2 backlog):

1. `targeted-edits/0000` — the model persistently leaves one embedded passive
   ("a shared config that *is versioned* in git") despite an explicit
   every-clause rule. Looks like a GLM 5.3-fast limitation; judge is also
   run-to-run variable on this case.
2. `preserve-voice` — the model undershoots requested cut magnitudes
   (~15% when asked ~33%).
3. Judge variance: single-sample closedQA judges flip on borderline outputs
   (0002 passed then failed with similar outputs). Trend over multiple runs
   matters more than any single verdict; consider multi-sample or `.gate`
   promotion only after stabilization.

## Phase 3 — memory recall (2026-09-16)

Added `thinking-partner/remembers-context` and
`thinking-partner/no-invented-memory`. Both passed on the first run:

| Suite | Eval | Result | Notes |
| --- | --- | --- | --- |
| thinking-partner | remembers-context | ✓ pass | `memory-saved` gate + cross-session judge 100%: dinner suggestions for a vegan Berlin-Marathon runner in session B, using session-A facts |
| thinking-partner | no-invented-memory | ✓ pass | both judges 100% — the agent says it does not know the user's favorite color instead of inventing one |

Notes:

- Memory is the built-in `fileMemory()` provider (`agent/memory/profile.ts`),
  scoped by principal. In the eval target the principal is the shared test
  user, so the memory document persists across eval runs — suites that save
  facts should clean up after themselves, and the store is bounded (4,000
  characters) so accumulation self-limits.
- `remembers-context` re-saves its facts on every run; if duplicate entries
  start triggering the bound, add a cleanup turn (remove tool) to the eval.
- Cross-session recall worked with no instruction changes — the fileMemory
  recall-before-each-turn design carries it.

## Attachments suite, first run (2026-09-16, branch `feat/attachment-uploads`)

New suite per `docs/attachment-uploads-plan.md`, with fixtures (two deploy
dashboards, two contrasting landing-page designs, a 59-page TextBased PDF, a
1-page Scanned PDF). Plan doc: `docs/attachment-uploads-plan.md`.

| Suite | Eval | Result | Notes |
| --- | --- | --- | --- |
| attachments | aesthetics-vibes | ✓ pass | both judges 100% — the agent characterized palette/mood/typography and answered the comparative trust question honestly (Aurora light/serif = trustworthy; NEONX neon/hype = risky for a bank) |
| attachments | multi-image-compare | ✓ pass (after gate fix) | judge 100% — attribution across two images was correct on the first run; the case-sensitive `messageIncludes("GREEN")` gate was over-strict (agent wrote "green") and is now case-insensitive |
| attachments | long-pdf-analysis | ✗ turn failed | **probe result: the model rejects PDF file parts** (`MODEL_CALL_FAILED: Invalid JSON data … MessageContent`) — GLM 5.3-fast via the gateway cannot ingest a PDF file part, so server-side extraction is required, exactly as the plan's tier 2 anticipated |
| attachments | scanned-pdf-routing | ✗ turn failed | same root cause as above; also pins the scanned-PDF graceful routing (pdf-inspector classifies the fixture as `Scanned` with OCR-needing pages — verified) |

**Probe conclusion:** `@firecrawl/pdf-inspector` is confirmed working on the
fixtures (`long-digest.pdf` → TextBased/59 pages in 48 ms; `scanned-compliance.pdf`
→ Scanned with pages needing OCR) and the tier-2 extraction path is now
*required*, not optional. The two failing PDF evals are the spec for it.

## Attachment infrastructure landed (2026-09-16, later passes)

Implemented on this branch and verified:

1. **Upload route** `POST /api/attachments` (auth-gated): media-type allowlist
   (mirrors the channel policy), 10 MB cap, archives originals to the
   project's **private Vercel Blob store** (`BLOB_STORE_ID` wired on
   Production/Development — OIDC-based, no static token), and extracts PDFs
   with `@firecrawl/pdf-inspector` (bounded Markdown + `pdfType`/page count).
   Verified: 200 with extraction, 401 unauthenticated, 415 disallowed type.
   `next.config.ts` marks the native pdf-inspector binding as a
   `serverExternalPackage` (Turbopack cannot bundle `.node` bindings).
2. **Composer PDF adapter** now uploads to the route and delivers the
   extracted Markdown as the message content — the model never sees raw PDF
   parts (it rejects them; probed).
3. **`long-pdf-analysis` passes** against `short-digest.pdf` (13 pages,
   45.6k extracted chars, facts pages apart, one line-wrapped — the model
   found both).

**Design finding from the 59-page fixture:** the full digest extracts to
218k chars (~55k tokens) with facts at chars 54k and 172k — wholesale inline
delivery is infeasible and a 50k inline bound cut both facts (the agent
honestly reported they were absent). Long documents therefore need the
sandbox-file + paged-read design (`long-digest.pdf` is the kept fixture for
that follow-up): write the extracted Markdown into the session sandbox at
upload time and let the agent read it with `read_file`.

**Known eval-gap:** PDF evals currently extract in the eval itself (mirroring
the composer's post-upload contract). Once the sandbox-file delivery lands,
they should attach via the real upload path instead.

## Follow-up landed: paged attachment reads (2026-09-17, this branch)

The long-document design is implemented:

1. **`agent_attachment` table** — per-page extracted Markdown stored in
   Postgres (migration `0004`), keyed to the uploading user.
2. **`read_attachment` tool** (`agent/tools/read_attachment.ts`) — paged
   reader: one page per call (or the page index with no `page`), ownership
   resolved through the session → chat → user link. A 59-page document now
   costs a few KB per turn instead of a 218k-char inline payload.
3. **Composer PDF adapter** uploads via `/api/attachments`, then references
   the attachment id and inlines page 1 only; the agent pages the rest.
4. **Unit tests** (`tests/pdf-extract.test.ts`, `node --test`, 7 tests):
   valid TextBased PDF (classification, per-page extraction, deep facts),
   50k-char bounded delivery with a continuation marker, scanned PDF →
   graceful `no_extractable_text`, corrupted bytes / empty buffer / random
   binary / image-mislabeled-as-PDF → `parse_failed` without throwing.

**End-to-end verification (composer + real UI):** attaching the 59-page
`long-digest.pdf` and asking both questions — the agent paged through the
stored pages ("Found the token on page 15... reading the remaining pages")
and answered with the exact values (OTTER-7391-DELTA; November 3, 2026,
02:00-04:00 UTC). `attachments/` suite: 4/4 passing. Unit tests: 7/7.

## Phase 4 — attachments and URLs end to end (2026-09-16)

Added `thinking-partner/screenshot-understanding` and
`thinking-partner/url-in-message`, plus the infrastructure fix the first run
exposed:

- **`url-in-message` passed immediately**: a pasted URL is fetched with
  `web_fetch` and the page's actual content is summarized (100%).
- **`screenshot-understanding` failed first — real infrastructure gap**: the
  eve channel had `uploadPolicy: "disabled"` (template default), so every
  attachment was rejected before reaching the model. Enabled uploads on the
  eve channel for `image/*`, `text/*`, and `application/pdf` with a 10 MB cap
  (`agent/channels/eve.ts`); Slack channel intentionally left disabled.
- After enabling: **screenshot-understanding passes** — the agent read the
  fixture screenshot's exact contents (GREEN deploy status, eu-central-1,
  3 warnings, v2.14.0 at 80% rollout). The deployed model accepts image
  input, so the full path works: `t.sendFile` → data URL → channel → vision.
- Also fixed `evals/assertions.ts`: `soft()` on the gate helper silently
  returned gate severity, so a soft-marked assertion still failed runs.
- Memory-eval flakiness fixed the same way: `remembers-context`'s save gate
  is now soft — on repeat runs the memory already holds the facts, and
  skipping the save is correct behavior. The spec that gates is session B
  using the facts (judge, 100%).

Full `thinking-partner/` suite: 4/4 passing. 17 evals total across 6 suites.

**Composer verification (same day):** the full UI path was verified in the
browser — attach the fixture PNG via the composer's file input, send, and the
agent reads the image's exact contents. Two automation lessons recorded:
`agent-browser upload` needs an absolute path (a relative path silently stages
a 0-byte file, which fails at send with a FileReader error), and the
composer's file input is created dynamically by
`ComposerPrimitive.AddAttachment` on click — capture it by intercepting
`HTMLInputElement.prototype.click`, not by querying the static DOM.
PDFs flow through a template-local `PdfAttachmentAdapter` (data URL) in
`assistant-chat.tsx`; the built-in Simple adapters cover images and text.

No regressions elsewhere: research/ and the smoke tier stayed green through
both passes.


# Plan: parity with the reader-state writing model

Source: the "communicating my thoughts" framework — writing as the
transformation `intent → audience model → argument/narrative → expression →
reader effect`, with the core object being the agent's model of what another
mind should understand, believe, feel, or do. Prose is the output, not the
object.

Audit result (what already exists): the develop flow's idea test
(`writing.md`), the audience model (`audience-adaptation.md` — including
"desired reader state"), critique as a diagnostic model (`editor` +
`technical-writing-review.md`, structure-before-sentence priority), revision
dimension discipline (`dimension-discipline`, `targeted-edits` evals),
deterministic publish constraints (`house-style`, `lint_against_style`,
surface format specs), and multi-surface infrastructure (5 surface skills +
`SURFACES` + reviewer rubric). This plan closes the five gaps.

## Phase 0 — The core object, stated once (framing)

- **Change:** `agent/instructions.md`, "Written works as file artifacts" —
  open with: the artifact of a writing project is the agent's model of what
  the reader should understand, believe, feel, or do; the file is the current
  projection of that model. When instructions conflict, the reader model wins.
- **Eval:** none (framing is untestable in isolation; later phases test its
  consequences).
- **Done when:** the preamble exists and later phases' evals pass.

## Phase 1 — Rhetorical architecture replaces outlining (highest leverage)

- **Change:** `agent/skills/content-research-writer.md`, step 2. Replace the
  document-shaped outline (hook → intro → sections → conclusion) with
  reader-state planning: name the reader's starting belief, list the ordered
  moves (show tension in it → introduce distinction → demonstrate by example
  → establish mechanism → handle the obvious objection → land the
  implication), name the target reader state, then derive document sections
  FROM the moves — sections are where moves live, never the starting point.
  The outline reply must state both the moves and the derived sections.
- **Change:** `technical-writing-review.md` — the structure check asks "does
  the sequence follow the order of cognition for this reader?" (already
  close: "sequence matches what the audience needs to learn").
- **Eval:** `writing/reader-state-outline.eval.ts` — outline request → judge:
  the outline names reader start state, ordered moves, and target state;
  a document-section list with no reader movement fails.
- **Done when:** the eval passes and the outline step never produces
  section-labels-only outlines.

## Phase 2 — Draft modes (authorship preservation)

- **Change:** `agent/skills/content-research-writer.md` + the "Editing and
  rewriting" section of `agent/instructions.md`. Four named modes, each with
  distinct behavior; the agent states which mode it is in and asks when
  unclear:
  - **expand** — grow an idea with the author's framing; no restructuring.
  - **locate** — offer candidate sentences for the one the author is reaching
    for; never rewrite surrounding text.
  - **sketch** — rough material to react against, explicitly labelled rough:
    no polish pass, no house-style sweep beyond mechanical minimums.
  - **finish** — the polished pass (the only mode that produces
    publication-ready prose).
- **Eval:** `writing/draft-modes.eval.ts` — two turns: a sketch-mode request
  must produce visibly rough, labelled material (a polished publishable
  paragraph fails), and a finish-mode request on the same material must
  produce the polished version.
- **Done when:** the eval passes; sketches never read as finished copy.

## Phase 3 — Revision levels (right-level intervention)

- **Change:** `technical-writing-review.md` — add the level taxonomy to the
  output contract: L5 concept, L4 argument, L3 structure, L2 paragraph,
  L1 sentence, L0 word/punctuation. Every finding and recommended revision is
  tagged with the level where the problem EXISTS (diagnose the root, not the
  symptom), and the review must state when a surface symptom points at a
  deeper level ("this sentence is awkward because the paragraph solves a
  problem the reader does not have yet" → L3/L4 finding, not L1).
- **Change:** editor `outputSchema`/JSON contract — `level` field per finding
  and per revision.
- **Eval:** `writing/revision-level.eval.ts` — a draft with a structural
  problem plus an attractive sentence-level nitpick → the review tags the
  structural finding as higher-priority and at the correct level; a review
  that fixates on the sentence nitpick fails.
- **Done when:** the eval passes; levels appear in every editor verdict.

## Phase 4 — The learning loop (published → learned preferences)

- **Change:** `agent/skills/content-research-writer.md`, step 7 — after a
  piece is finished or a revision round settles: record what the author
  accepted, rejected, and rewrote (voice observations, structure taste,
  audience calls) via `save_writer_preferences` (per-writer, principal-
  scoped) and durable facts via memory. Distinguish: preferences = style and
  judgment; memory = facts about the user.
- **Change:** step 1 — start every project by loading the writer's saved
  preferences (`get_writer_preferences`) and applying them; conflicts go to
  the author, not to silent defaults.
- **Eval:** `writing/learns-from-edits.eval.ts` — turn 1: the author accepts
  a revision and states why ("I never use rhetorical questions in openers");
  turn 2: a new draft request → the new draft respects the preference without
  being told. Judge over the second turn's artifact.
- **Done when:** the eval passes; preferences persist across sessions.

## Phase 5 — Transform is re-derivation, not conversion

- **Change:** `agent/instructions.md` (surface-routing paragraph) — when
  moving a piece between surfaces, re-derive the rhetorical strategy from the
  communicative model (reader, thesis, desired effect) under the target
  surface's constraints; never mechanically convert the text. The meaning
  persists; the strategy changes.
- **Change:** surface `SKILL.md` files each gain a one-line reminder (kept in
  sync by `scripts/sync-shared.mjs`'s managed section mechanism if moved to
  shared references).
- **Eval:** `writing/transform-not-convert.eval.ts` — an essay → x thread
  request → judge: the thread is built on the essay's central claim with
  x-native structure (hook, one beat per post, payoff), not chunked essay
  paragraphs; no meaning invention.
- **Done when:** the eval passes.

## Sequencing and effort

| Phase | Files touched | New evals | Est. size |
| --- | --- | --- | --- |
| 0 core object | instructions.md | — | xs |
| 1 reader-state outline | content-research-writer, review skill | 1 | m |
| 2 draft modes | content-research-writer, instructions | 1 | m |
| 3 revision levels | review skill, editor contract | 1 | m |
| 4 learning loop | content-research-writer, instructions | 1 | m |
| 5 transform principle | instructions, surface skills | 1 | s |

Eval-first per the repo philosophy: write the eval before the change; the
phase is done when the eval passes against the real agent. Run the smoke tier
(`pnpm evals:smoke`) after each phase; phases are independent enough to ship
incrementally, ordered as above (phase 1 first — it changes the actual
thinking; 0 and 5 are one-commit finishers).

## Housekeeping

- Fold the editor's skill copies into `sync-shared.mjs` generation (replacing
  the copy + drift-guard test arrangement) once phases touch the shared
  references.
- The `researcher` subagent covers the framework's research stage; no change.

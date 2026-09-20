# Plan: agent-assisted editing for technical blog posts

Branch: `feature/writing-enhancement`

## Where we are

The agent already has a writing stack, and the pieces are complementary:

| Piece | Location | Role |
| --- | --- | --- |
| Voice constraints | `agent/instructions.md` ("Writing voice") | Always-on: no em dashes, Oxford comma, precision over intensity, evidence over evaluation |
| General writing skill | `agent/skills/writing.md` | Universal bar for producing prose: idea selection, argument structure, editing order. Loaded for drafting/substantive revision |
| Conversational drafting | `agent/instructions.md` | Writing-partner behavior across turns; faithful revision |
| Editing rules | `agent/instructions.md` | Return clean edits, honor magnitudes, never change claims while restyling |
| Canvas | `agent/tools/write_file.ts` → file cards | Drafts persist per chat and open in the side-by-side viewer (markdown rendering now works) |
| Research | `web_search`, `web_fetch`, `exa_agent_run` | Fact-checking surface already exists |
| HITL | eve `ask_question` | Park the turn for a user decision |
| Evals | `evals/writing/` (audience-fit, dimension-discipline, logic-edit, preserve-voice, structure-edit, targeted-edits) plus behavior/general suites, judged by `evals.config.ts` | Established pattern for asserting behavior |

## Gap

There is no skill for **critiquing** a technical draft. The existing `writing`
skill governs producing and revising prose; nothing defines what a *review*
looks like: the review procedure, the argument map, the revision priorities,
or the standard ("does the piece let the reader see why the author believes
it?"). The user's new **technical writing review** skill fills exactly that
gap, and its opening line already says so: "This skill reviews argument and
exposition; voice and house style live elsewhere."

A second gap is behavioral: today the agent returns edited prose **in the chat
thread** (instructions.md's editing rules say "return the edited text itself",
and the writing evals assert on `turn.message` with `t.usedNoTools()`). For
blog-post-length work that floods the thread. Written works should live as
**file artifacts** (the canvas) with the thread reserved for critique,
decisions, and short snippets.

## Phase 1 — Install the review skill (small, do first)

1. Add `agent/skills/technical-writing-review.md` with the provided content,
   formatted as an eve skill: `description` frontmatter (a routing hint, per
   `node_modules/eve/docs/skills.mdx`) + the body unchanged.
2. Wire it into `agent/instructions.md` next to the `writing` skill:
   - Load `technical-writing-review` when the user asks for review, feedback,
     or a critique of a technical essay, blog post, or engineering narrative.
   - Relationship: `writing` governs producing prose; `technical-writing-review`
     governs critiquing it. For "edit my technical blog post", load both —
     review for the argument, writing for the sentence work. When they
     conflict, the review skill wins on argument structure; the instructions'
     voice section stays authoritative for house style (the skill explicitly
     defers voice "elsewhere" — that is instructions.md).

## Phase 2 — Artifacts in files first (behavior change)

Written works become file artifacts from the first draft onward. The thread is
for collaboration; the canvas is for the work.

1. **Instructions change** (the "Editing and rewriting" and "Conventional
   drafting" sections): when a piece is a written work — a blog post, essay,
   or any multi-paragraph draft — the agent writes it to a file (`write_file`
   → canvas artifact) and revises **in the file**. The thread carries the
   critique, questions, decisions, and at most short quoted snippets (a
   rewritten paragraph when that is the whole ask). Full drafts never go into
   the thread.
2. **Threshold policy**: short, single-paragraph edits and quick snippets may
   stay in chat (paste-ready is the right shape there); anything
   blog-post-length — or anything the user has open as a canvas file — is
   file-first. When unclear, default to the file.
3. **Review output stays in the thread.** The review (argument map, weakest
   links, recommended changes) is discussion, not the artifact — it renders in
   the thread next to the canvas file. This is the natural split: the skill's
   review-output contract describes thread content; the draft is the file.
4. **Eval contract updates.** The existing `evals/writing/*.eval.ts` assert on
   `turn.message` with `t.usedNoTools()` — that contract inverts for
   file-first work. Update the substantive-drafting evals to assert
   `t.calledTool("write_file")` and judge the produced file content from the
   tool-call events; keep chat-only assertions for the short-snippet cases.
   This is the largest eval-side change and should land together with the
   instructions change so the suite tests the new behavior, not the old.

## Phase 3 — Make the review workflow concrete on the canvas

1. **Revision history is a real gap.** `upsertAgentFile` overwrites the single
   row per (chat, path) — `v1` in the canvas header is cosmetic. For blog
   editing, prior drafts matter. Options, smallest first:
   - Convention: the reviewer writes `drafts/<slug>.md` as the live copy and
     the user asks for "save this version" → copy to `drafts/archive/<slug>-<n>.md`.
   - Better: add `agent_file_revision` rows written in `upsertAgentFile` and a
     `listAgentFileVersions`, surfacing version switching in the canvas header.
2. **Fact-check as a review step.** The skill's "evidence" gate ("which claims
   are demonstrated, measured, sourced, or concretely illustrated?") should use
   `web_search`/`web_fetch` to verify checkable claims (numbers, citations,
   API behavior) before the review claims they are unsupported. Plan: the
   review procedure gains an explicit step — check at most the few claims the
   argument depends on, qualify everything else observed/measured/inferred.
3. **HITL revision selection.** The skill mandates "a small number of
   high-leverage revisions" and forbids whole-piece rewrites by default. Pair
   the review output with eve's `ask_question`: present the top revisions as
   options and let the author choose what to apply. This turns the review from
   a wall of feedback into a decision the author controls.
4. **Fresh-eyes second pass.** eve's subagent tool can run an independent
   reviewer turn with the review skill loaded — useful for long posts where
   the drafting context would bias the critique. Keep this optional; a single
   well-run review is usually enough.

## Phase 4 — Review evals inside the existing writing suite

Fold the review evals into `evals/writing/` (not a new suite) so they share
`fixtures/drafts.json`, the judge config, and the run/reporting surface:

- **Planted-flaw review evals** (`evals/writing/review-*.eval.ts`): fixtures
  with a specific defect each — a conclusion that arrives before its
  mechanism; an inert technical detail with no "so what"; a claim that jumps
  layers; a product introduced before its necessity. Assert on the review's
  *flags*, not on a rewrite: the argument map names the missing link, the
  review does not rewrite the piece unprompted, structural fixes are
  prioritized over line notes. Use `t.loadedSkill("technical-writing-review")`
  to assert the skill actually loads.
- **File-first assertion baked in**: review evals seed the draft via
  `write_file`-equivalent setup and assert the agent reviews the artifact
  (thread critique + edits applied to the file), not a full rewrite in chat —
  consistent with Phase 2.
- **Faithfulness eval**: when the user accepts only some recommended
  revisions, the next revision preserves the untouched content (mirrors the
  existing cross-session-bleed pattern).
- Add the flaw fixtures to `fixtures/` (extend `drafts.json` or a sibling
  `review-fixtures.json`) so dataset fan-out works the same way
  `targeted-edits.eval.ts` uses it.

## Phase 5 — Later, only if the workflow earns it

- **Notion as a draft source**: a connection already exists; pulling a draft
  from Notion, reviewing it, and writing back would close the loop for
  drafts that do not live in the canvas.
- **Publishing targets** (Medium/Hashnode/Substack APIs) — only after the
  edit loop is trusted.
- A `defineSkill` upgrade if the review skill ever needs packaged reference
  files (checklists, worked examples of an argument map).

## Explicit non-goals

- No full-draft rewrites by default — the skill's review output format already
  forbids it, and instructions.md's editing rules reinforce it.
- No prose dumps in the thread — substantive drafts are files; the thread
  carries collaboration.
- No separate "voice" skill — house style stays in instructions.md where the
  skill expects to find it.
- No publishing integrations until the edit loop itself is proven.

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
| Evals | `evals/` (behavior, company-research, general-chat) with a judge config | Established pattern for asserting behavior |

## Gap

There is no skill for **critiquing** a technical draft. The existing `writing`
skill governs producing and revising prose; nothing defines what a *review*
looks like: the review procedure, the argument map, the revision priorities,
or the standard ("does the piece let the reader see why the author believes
it?"). The user's new **technical writing review** skill fills exactly that
gap, and its opening line already says so: "This skill reviews argument and
exposition; voice and house style live elsewhere."

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

## Phase 2 — Make the review workflow concrete on the canvas

The pieces for iterating on drafts already exist and now compose well:
`write_file` persists drafts as chat files that open in the canvas viewer with
rendered markdown; `read_file`, `glob`, `grep` reach earlier drafts;
`ask_question` parks a turn for a human decision.

1. **Draft + critique split.** The reviewed draft lives in the canvas (the
   artifact); the review (argument map, weakest links, recommended changes)
   renders in the thread. This matches the skill's review-output contract and
   the canvas already displays both sides cleanly.
2. **Revision history is a real gap.** `upsertAgentFile` overwrites the single
   row per (chat, path) — `v1` in the canvas header is cosmetic. For blog
   editing, prior drafts matter. Options, smallest first:
   - Convention: the reviewer writes `drafts/<slug>.md` as the live copy and
     the user asks for "save this version" → copy to `drafts/archive/<slug>-<n>.md`.
   - Better: add `agent_file_revision` rows written in `upsertAgentFile` and a
     `listAgentFileVersions`, surfacing version switching in the canvas header.
3. **Fact-check as a review step.** The skill's "evidence" gate ("which claims
   are demonstrated, measured, sourced, or concretely illustrated?") should use
   `web_search`/`web_fetch` to verify checkable claims (numbers, citations,
   API behavior) before the review claims they are unsupported. Plan: the
   review procedure gains an explicit step — check at most the few claims the
   argument depends on, qualify everything else observed/measured/inferred.
4. **HITL revision selection.** The skill mandates "a small number of
   high-leverage revisions" and forbids whole-piece rewrites by default. Pair
   the review output with eve's `ask_question`: present the top revisions as
   options and let the author choose what to apply. This turns the review from
   a wall of feedback into a decision the author controls.
5. **Fresh-eyes second pass.** eve's subagent tool can run an independent
   reviewer turn with the review skill loaded — useful for long posts where
   the drafting context would bias the critique. Keep this optional; a single
   well-run review is usually enough.

## Phase 3 — Prove it with evals

The project already runs behavior evals with a judge model; a review-quality
suite is the same pattern and guards against regressions when the skill or
instructions change:

- `evals/writing-review/` with planted-flaw drafts (a conclusion that arrives
  before its mechanism; an inert technical detail with no "so what"; a layer
  jump; a product introduced before its necessity). Assert on the review's
  *flags*, not on a rewrite: the agent must name the missing mechanism in the
  argument map, must not rewrite the whole piece unprompted, and must
  prioritize structural fixes over line notes.
- One eval for faithfulness: when the user accepts only some recommended
  revisions, the next revision preserves the untouched content (mirrors the
  existing cross-session-bleed pattern).

## Phase 4 — Later, only if the workflow earns it

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
- No separate "voice" skill — house style stays in instructions.md where the
  skill expects to find it.
- No publishing integrations until the edit loop itself is proven.

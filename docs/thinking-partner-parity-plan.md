# Plan: thinking-partner evals — Unpack, Develop, Branch, Synthesize, Externalize, Resume

The thinking-partner suite currently pins memory recall, transparency, and a
couple of conversational behaviors. This plan adds the six collaboration
flows the suite exists for. Eval-first per the repo philosophy: each eval is
the spec for a behavior; if it fails, the agent (instructions, not a new
skill — thinking-partner behaviors are conversational) is tuned until it
passes.

Suite conventions to follow: `evals/thinking-partner/*.eval.ts`, smoke tags,
multi-turn via repeated `t.send`, cross-session via `t.newSession()`,
deterministic gates for mechanics (tool used, artifact created, reply bounds),
judge gates for quality, soft gates for signals we watch without blocking.
`evals/README.md` gets a row per eval.

The through-line anti-pattern for the whole suite: **the agent is a
collaborator, not an autocomplete.** Prematurely polishing, answering, or
artifact-ing an underdeveloped thought fails, in every flow.

## 1. Unpack — `thinking-partner/unpack-not-answer`

- **Input:** an extremely underdeveloped observation. Fixtures from the
  framework's own examples: "French feels weirdly orderly to me" /
  "I think businesses are going to need a business-logic layer for agents" /
  "why do downtown buildings get demolished this way?" (fan-out over
  `loadJson` fixtures if the pattern fits, else one eval per fixture).
- **Spec:** the agent helps uncover what the user is noticing. It engages the
  specific observation (word order, the layer analogy, demolition economics —
  not a generic "interesting thought"), offers a distinction, a candidate
  mechanism, or 1-2 focused questions, and does not deliver a comprehensive
  answer or start an artifact.
- **Gates:** `notCalledTool("write_file")` (deterministic); soft gate on reply
  length (an unpack turn is a conversation turn, not an essay).
- **Judge:** engages the specific content; makes at least one move that
  uncovers (distinction / candidate mechanism / pointed question); does not
  lecture, does not simply agree, does not answer the implied question
  exhaustively.
- **Agent delta if failing:** an instructions.md nudge — underdeveloped
  observations get unpacked, not answered.

## 2. Develop — `thinking-partner/develop-idea`

- **Input:** multi-turn, one idea carried across three turns:
  1. "I think businesses are going to need a business-logic layer for agents."
  2. User pushback: "isn't that just what ERPs and integration middleware
     already were?"
  3. "Okay — so what would that layer actually contain?"
- **Spec:** the agent manipulates the idea with the user: defines terms, makes
  distinctions, tests the analogy, generates hypotheses, challenges
  assumptions, connects to what was said. Turn 2 must take the objection
  seriously (steelman it, concede what is right, refine the claim) — the
  `warm-honest-rational` behavior applied to ideas. Turn 3 produces a concrete
  structure derived from the exchange, using the terms the exchange
  established.
- **Gates:** `notCalledTool("write_file")` (still thinking, not shipping).
- **Judge:** per turn — t1 engages the specific claim and makes at least one
  conceptual move; t2 treats the pushback as material (neither defensive
  capitulation nor dismissal); t3's structure uses the exchange's vocabulary
  and answers its open tension.

## 3. Branch — `thinking-partner/branch-and-return`

- **Input:** multi-turn, four turns: two turns developing the
  business-logic-layer thread → the user branches ("that reminds me of
  something unrelated I keep noticing: every internal tool ends up being a
  spreadsheet") → one or two turns on the tangent → the user returns ("okay,
  back to the business-logic layer — where were we?").
- **Spec:** the tangent is engaged seriously on its own terms (not dismissed,
  not immediately forced back into the main thread), and the return
  reconstructs the main thread's actual state — the specific points made
  before the branch, so the work is not lost.
- **Gates:** multi-turn shape only (no tool gates — this is pure
  conversation).
- **Judge:** the tangent turns engage the spreadsheet observation
  specifically; the return turn references the main thread's concrete prior
  content and continues it (generic "as we discussed earlier" fails).
- **Agent delta if failing:** an instructions.md nudge — tangents get pursued
  and the main thread's state is kept resumable.

## 4. Synthesize — `thinking-partner/synthesize-delta`

- **Input:** multi-turn (3-4): develop the idea with a real pivot — the
  initial framing ("a business-logic layer for agents") gets reframed by a
  distinction drawn mid-conversation ("the layer is the contract between
  agents and business rules, not the code that runs them") — then: "Okay,
  what do I actually think now?"
- **Spec:** collapse the exploration into the current model, with the delta
  visible: what the user came in thinking, what changed and why, and what is
  still open. No new claims; no silent resolution of open questions.
- **Gates:** `notCalledTool("write_file")` (a synthesis is a reply, not an
  artifact — unless the user asks for one, which is the Externalize flow).
- **Judge:** the stated current model matches the conversation's final state
  (not the opening one); the change from the initial idea is explicit; open
  questions are flagged as open.

## 5. Externalize — `thinking-partner/externalize-formats`

- **Input:** the same 2-turn development as Synthesize, then two variants:
  "turn this into a short memo for my team" and "explain it to a friend who
  isn't in tech".
- **Spec:** the same underlying model projected into different formats. The
  memo: decision-ready structure, in-thread or as an artifact via
  `write_file` (artifact expected for a memo — `journal-artifact` is the
  precedent). The friend explanation: plain register, no jargon, in-thread.
  Content traces to the conversation; nothing invented; voice preserved.
- **Gates:** memo variant gates `write_file`; friend variant gates
  `notCalledTool("write_file")` (an explanation to a friend is a reply).
- **Judge:** memo — structure serves a decision, substance traces to the
  exchange; friend — register matches the audience, the idea survives the
  translation, no condescension.
- **Connection:** generalizes the existing `journal-artifact` eval; the
  writing suite's surface skills are the deeper versions of this for
  published formats.

## 6. Resume — `thinking-partner/resume-model`

- **Input:** multi-session (the `remembers-context` pattern): session A
  develops the business-logic-layer idea across three turns — thesis, one
  distinction drawn, and one open question deliberately left open ("the open
  question is whether that contract layer is code or config"). Then
  `t.newSession()` and: "I was thinking about that business-context-as-software
  idea again…"
- **Spec:** the agent reconstructs the relevant MODEL — the thesis as it
  evolved, the distinction that was drawn, and the open question left open —
  and invites continuation. It does not merely quote the old chat, does not
  re-ask what the idea was, and does not fabricate parts of the model that
  were never discussed.
- **Gates:** no re-ask of the idea itself; no `ask_question` gate needed —
  judge handles the reconstruction quality.
- **Judge:** reconstructs the specific distinctions and decisions (not a
  generic summary); surfaces the open question as still open; tolerates
  hedged recall ("if I remember right") — the stale-memory reconfirm rule
  applies to acting, not to reconstructing.
- **Infra:** memory (exists — `remembers-context` proves the path); this eval
  pins reconstruction of a *structure with open threads*, which is new.
- **Note:** the "three weeks later" timing is approximated by the
  multi-session pattern; memory timestamps exist if a timing-sensitive
  variant is ever needed (see `stale-memory-reconfirm` for the acting-on-
  stale-facts boundary).

## Sequencing and effort

| Order | Eval | Infra needed | Est. size |
| --- | --- | --- | --- |
| 1 | unpack-not-answer | none (instructions nudge if failing) | s |
| 2 | develop-idea | none | m |
| 3 | branch-and-return | none | m |
| 4 | synthesize-delta | none | m |
| 5 | externalize-formats | write_file (exists) | m |
| 6 | resume-model | memory (exists) | m |

All six are smoke-tagged; `resume-model` also carries `multi-session`. Run
`pnpm exec eve eval thinking-partner --strict` per eval during development;
the full suite runs in `evals:behavior`.

## Expected agent deltas (only if evals fail)

The agent's conversational behavior may need one or two nudges in
`agent/instructions.md` rather than a new skill: (a) underdeveloped
observations get unpacked, not answered; (b) tangents are pursued and the
main thread stays resumable; (c) syntheses show the delta from the starting
thought. Everything else should pass on the existing instructions, skills,
and memory infra.

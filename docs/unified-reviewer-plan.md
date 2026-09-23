# Plan: unify the editor and reviewer into one diagnostic reviewer

Decision: collapse `agent/subagents/editor` (the scorer) and
`agent/subagents/reviewer` (the surface pass) into a single **diagnostic
reviewer** whose job is to build a model of the piece and return a structured
editorial judgment. The parent agent discusses the diagnosis with the author,
the author decides what to act on, and the parent executes revisions
separately. Review → decision → revision stay three distinct state changes.

The core instruction for the unified reviewer:

> Build the strongest possible model of what the author is trying to
> accomplish, experience the piece as a reader, diagnose the highest-level
> causes preventing that reader-state change, and recommend the smallest
> interventions with the greatest editorial leverage. Never confuse personal
> preference with a defect.

## Why unify

The current split forces a routing choice (style vs argument) before anyone
has read the piece — but the diagnosis itself determines which layer the
problem lives at. One reviewer that diagnoses across all levels (L0–L5) and
returns one prioritized brief removes the routing guess and the duplicate
context-loading. The scoring the editor did (1–10 coherence/flow/audience)
becomes the brief's prioritized findings with confidence levels — a judgment
the parent can act on directly, without the author having to interpret
numbers.

## The pipeline: multi-pass internally, one judgment externally

Enforced in the reviewer's `instructions.md` as a strict working protocol.
The reviewer runs passes in order; the author sees only the final brief.

1. **Read as a reader (no critique).** Reconstruct: subject, what the author
   is actually arguing, intended reader, what the reader understood before and
   after, the 3–5 ideas remembered, where attention rose or fell, where
   confusion set in, which claims felt novel or especially well expressed.
   This preserves the experienced artifact before the editorial lens
   rationalizes it. If the remembered ideas do not cluster around one center,
   that is a legibility finding (the hierarchy is not coming through).
2. **Reconstruct the rhetorical architecture.** Load `editorial_review`; for
   each section: reader enters with X → section does Y → reader leaves with Z.
   Evaluate whether each transition works (prerequisites late, conclusions
   before mechanisms, detours, repeated explanations, competing endings).
3. **Diagnose by level.** Force every criticism into L5 concept → L4 argument
   → L3 structure → L2 paragraph → L1 sentence → L0 mechanics. Rule: never
   recommend a lower-level intervention until the higher-level origin is
   ruled out. A boring paragraph in an unnecessary section is an L3 finding.
4. **Separate observation from prescription.** Every significant finding is
   four objects: Observation (quoted or located in the text) → Diagnosis →
   Reader consequence → Intervention. No bare "this feels long" findings.
5. **Argue against itself.** For every major recommendation — and always for
   deletions, reorders, thesis changes, qualification removals, splits, and
   substantive-claim challenges — construct the strongest case for leaving the
   draft as it is, then adjudicate: does the counterargument's benefit justify
   its reading cost?
6. **Prioritize ruthlessly.** Internally score findings on impact × confidence
   × leverage; return 5–8 findings, not everything noticed. A review that
   lists every imperfection is worse than one that identifies the few changes
   most likely to improve the piece.

## The output contract: the editorial brief

The `outputSchema` becomes the brief (structured; the parent renders it as
prose for discussion):

```
EDITORIAL MODEL
  apparentSubject / actualThesis / intendedAudience
  readerStateChange / conceptualSpine
WHAT TO PROTECT            # the working things, with why
PRIORITY FINDINGS (5-8)
  1. level (L5..L0)
     observation / diagnosis / readerConsequence
     recommendation / counterargument / confidence
RHETORICAL ARCHITECTURE
  current / proposed
CLAIMS TO EXAMINE          # epistemic precision: claims broader than their support
LOCAL NOTES                # only high-value L1/L0 observations
REVISION PRINCIPLE         # "the next draft should..."
```

Every substantial criticism carries textual evidence (section, quotation, or
range) — the floor that proves the draft was read.

## Context layers, with the artifact-first rule

The parent composes the delegation message with three layers:

- **Stable author context** — voice guidelines (house-style), learned writer
  preferences (`get_writer_preferences`), recurring interests.
- **Publication context** — surface, audience, intended technicality, length,
  purpose.
- **Artifact context** — the draft itself, linked research, author notes.

The reviewer's rule: **infer from the artifact before consulting author
context.** Context evaluates alignment; it never explains away what is absent
on the page. If the intended thesis is not recoverable from the essay, the
brief says so rather than silently supplying it.

## The adversarial second pass

Phase A implements pass 5 (self-adversarial) inside the reviewer. A
**skeptical-reader subagent** (draft + diagnosis in; attacks the diagnosis:
unsupported findings, imposed style preferences, cuts that destroy nuance,
missed problems) is deferred to its own phase and used selectively — only for
reviews recommending deletion, reordering, or a thesis change. Two reviewers,
not a committee.

## What happens to the existing pieces

- `agent/subagents/editor/` — **removed**. Its scoring collapses into the
  brief's findings (confidence replaces the 1–10 scores); its house-style
  audit becomes L0 findings; its argument map becomes the brief's
  conceptual spine.
- `reviewer/` skills — keep `editorial_review` (the pass-2+ lens),
  `house-style` copy, and the `get_surface_rubric` tool + generated rubric.
  Drop its `technical-writing-review` copy (superseded by
  `editorial_review`; the parent keeps its own copy for inline section work).
- `tests/editor-skills-sync.test.ts` — retargeted from the editor to the
  reviewer's skill copies.
- `lib/agent/retry-policy.ts` — remove the `editor` entry, keep/verify
  `reviewer`.
- `agent/instructions.md` — the review routing becomes one contract:
  finished-draft review → the reviewer; the parent presents the brief, the
  author picks, the parent applies accepted revisions with targeted
  `edit_file` spans (the existing author-choice flow, unchanged).
- UI: no change — the delegation already renders as a task card.

## Evals: the reviewer itself, recursively

The reviewer's own state change: `draft → accurate, prioritized model of what
would make the draft better`. Fixtures with known editorial problems, one
spec each:

1. **Redundant section** — a technically polished draft with a redundant
   ~900-word section: the L3 structural redundancy is found and prioritized
   before any sentence polish.
2. **Ugly prose, novel argument** — the idea is protected; the expression is
   diagnosed; no rewrite of the author's voice.
3. **Beautiful prose, unsupported thesis** — an L4 finding lands; the writing
   quality does not earn a pass.
4. **Necessary repetition** — a draft where repetition carries the argument
   (deliberate parallel cases): no mechanical "cut repetition" without
   adjudicating the counterargument.
5. **Unconventional structure** — an effective non-standard structure is not
   normalized into intro → three points → conclusion.
6. **Authorship preservation** — the brief distinguishes "I would write this
   differently" from "this prevents the intended reader-state change." The
   single most important property; anything phrased as preference fails.

Mechanics: the review runs as a background delegation; the eval's follow-up
turn collects the delivered verdict (the delivery-turn pattern already in the
event log). Judged on brief structure + the fixture's known problem, with the
authorship eval checking preference-vs-defect framing directly.

## Sequencing

| Phase | Work | Size |
| --- | --- | --- |
| A | Unify: new reviewer instructions (the 6-pass protocol), brief `outputSchema`, skills cleanup, editor removal, test/retry-policy retargeting, routing update | l |
| B | Delegation-message contract: the parent composes the three context layers; artifact-first rule | s |
| C | Evals 1–6, written first per fixture where feasible; agent tuning to green | m |
| D | Skeptical-reader subagent (selective escalation for destructive recommendations) | m |

Phase A is the risky one (a live agent contract changes); C's evals are the
acceptance gate. Ship A+B together, then C, then D.

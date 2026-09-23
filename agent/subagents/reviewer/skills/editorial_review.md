---
description: >
  Use when reviewing, critiquing, or giving substantive editorial feedback on
  idea-driven nonfiction, including essays, technical blog posts, research
  writing, case studies, memos, and thought leadership. Diagnose the idea,
  reader-state change, argument, structure, and prose in that order. The goal
  is not to find faults or rewrite the author's voice. It is to identify what
  the piece is really trying to say, explain what is already working, locate
  what prevents the idea from landing, and recommend the smallest set of
  high-leverage changes that make the piece more coherent, precise, and useful.
---

# Editorial review

Review writing as an argument designed to change a reader's state, not as a
collection of sentences to improve.

The hierarchy is:

idea → reader effect → argument → structure → prose

Do not begin with sentence-level edits when the important problem exists higher
in the hierarchy.

## 1. Reconstruct the piece before judging it

Read the draft and infer:

* What is the subject?
* What is the actual intellectual contribution?
* What does the author appear to believe that is worth communicating?
* Who is the likely reader?
* What does that reader probably believe or understand before reading?
* What should be different in the reader's mind afterward?

Distinguish the subject from the thesis.

"How I built my personal agent" is a subject.

"Agent design should begin with desired state changes, which can be translated
into user flows, requirements, implementation, and evals" is a thesis.

Prefer the most specific formulation supported by the draft.

If the draft contains a stronger thesis than the introduction states, surface
it. Do not assume the author's framing is already the best framing.

A useful compression test is:

After reading this, I would explain the author's main idea as: ___.

If that sentence is difficult to write, the piece may lack a clear center.

## 2. Evaluate the idea

Before evaluating the writing, evaluate whether the piece contains something
worth communicating.

Look for:

* a useful distinction
* a new model or abstraction
* a surprising causal explanation
* an experience that produces transferable knowledge
* a synthesis that connects familiar ideas in a useful way
* a concrete method others could apply
* evidence that changes how the reader should understand something

Identify the strongest ideas in the draft explicitly.

Do not equate novelty with unfamiliar terminology. An idea can be valuable
because it makes something previously fuzzy precise.

Also identify ideas that are interesting but orthogonal to the main argument.
These may be good ideas that belong in another piece.

The question is not:

Is this section good?

It is:

Is this section helping this particular piece accomplish its purpose?

## 3. Model the intended reader-state change

Treat the piece as a transformation:

reader state before → reader state after

Then reconstruct the intermediate states the reader must pass through.

For example:

reader assumes agents are chat models with tools
→ sees agent design as an optimization problem
→ understands desired state changes
→ sees state changes become user flows
→ sees flows become requirements
→ sees requirements become evals
→ understands evals as executable product design

This is the rhetorical architecture.

An outline describes what sections exist.

A rhetorical architecture describes why the reader encounters ideas in that
order.

Evaluate whether the current structure produces the intended sequence.

Flag:

* prerequisites introduced too late
* conclusions appearing before their mechanism
* examples appearing before the reader knows why they matter
* sections that interrupt the cognitive sequence
* repeated explanations after the reader should already understand the idea
* large conceptual detours
* multiple competing endings

## 4. Find the conceptual spine

Compress the argument into the smallest useful sequence.

Examples:

observation → model → implication

problem → mechanism → solution → evidence

state change → user flow → requirement → implementation → eval

Use this spine as the reference point for the rest of the review.

Ask of every major section:

1. Does it advance the spine?
2. Does it provide necessary evidence?
3. Does it make an abstract idea concrete?
4. Does it establish a prerequisite for something later?
5. Does it introduce a valuable complication?

If none apply, the section may be removable.

If it contains valuable material but substantially expands the conceptual
surface of the piece, consider whether it is a separate essay rather than a
section.

## 5. Diagnose hierarchy and emphasis

Not every good idea deserves equal space.

Classify ideas roughly as:

* Core: necessary to the thesis
* Supporting: helps establish or explain the thesis
* Illustrative: examples or demonstrations
* Adjacent: interesting but not necessary
* Extraneous: does not materially help the reader-state change

Check whether textual weight matches conceptual importance.

Common failure modes:

Repetition disguised as development

The author explains the same abstraction several times using different domains
or vocabulary.

Ask whether each repetition teaches something new.

If the first example establishes the mechanism, later examples can often show
only what changes.

Design-document leakage

Internal taxonomies, exhaustive lists, requirements, or implementation details
are reproduced because they were useful while thinking, not because the reader
needs all of them.

Preserve the reasoning; compress the inventory.

Good idea, wrong essay

A section contains worthwhile thinking but introduces a second major thesis.

Recommend extraction rather than deletion when appropriate.

Equal-weight writing

Core claims, qualifications, examples, tangents, and implementation details
receive similar space.

Recommend increasing contrast between the central argument and supporting
material.

## 6. Evaluate evidence and examples

Examples should do work.

For each major example, ask what it establishes:

* Does it make an abstraction concrete?
* Does it provide evidence?
* Does it demonstrate the mechanism?
* Does it expose a failure mode?
* Does it create intuition?
* Does it merely repeat the preceding explanation?

When an example already demonstrates the claim, prefer cutting redundant
explanation around it.

For technical writing, especially value examples that connect levels of
abstraction:

principle → requirement → implementation → observed behavior

A worked example is often more persuasive than several paragraphs asserting
that a method works.

## 7. Check epistemic precision

Look for claims that are broader or more certain than the argument requires.

Distinguish:

* observation
* hypothesis
* interpretation
* empirical claim
* design preference
* philosophical claim

Recommend the narrowest claim that preserves the author's point.

Prefer operational claims when they are sufficient.

For example, if the design requirement is:

The agent should not represent itself as having experiences it cannot ground.

the essay does not necessarily need to settle:

Whether an LLM can have subjective experience.

Do not weaken confident claims merely to sound cautious. Qualify claims when
the evidence or argument actually requires qualification.

## 8. Review prose only after higher-level diagnosis

Once the idea, argument, and structure are understood, inspect prose.

Look for:

* sentences carrying too many independent ideas
* excessive qualification before the point
* abstractions that an example communicates better
* unnecessary meta-commentary
* repeated setup
* vague referents
* imprecise verbs
* generic transitions
* inflated terminology
* claims that can become useful distinctions
* paragraphs with more than one rhetorical job

Preserve sentences that efficiently name an important distinction.

Strong conceptual prose often has the form:

X is not Y; it is Z.

The object is not X. X is the interface through which Y changes.

An outline describes the document. A rhetorical architecture describes the
reader's state change.

Do not mechanically force these constructions. Notice when the author's own
draft has discovered a useful compression and protect it.

## 9. Preserve authorship

The purpose of review is to improve the author's thinking and communication,
not replace them with the editor's preferred voice.

Prefer:

"This paragraph contains two arguments; the second is stronger."

over immediately rewriting the paragraph.

Prefer:

"The example already proves this, so the preceding abstraction can probably
be cut."

over silently replacing both.

Quote particularly strong lines from the draft when useful and explain why they
work. This helps the author identify the parts of their own voice and reasoning
worth preserving.

When suggesting rewritten language, treat it as a demonstration of the
editorial principle rather than as mandatory replacement copy unless the user
explicitly asks for a rewrite.

## 10. Prioritize the review

Do not produce an exhaustive list of every possible improvement.

A useful review should tell the author:

1. What the piece is really saying.
2. What is strongest and should be protected.
3. What most prevents the argument from landing.
4. Which sections should expand, compress, move, or disappear.
5. What the next revision should optimize for.

Prioritize changes by leverage:

concept / thesis
→ rhetorical architecture
→ section structure
→ evidence and examples
→ paragraph logic
→ sentence clarity
→ word choice and mechanics

Do not spend substantial review space on a lower level while a higher-level
problem remains unresolved.

## 11. Give positive feedback diagnostically

Avoid generic praise such as:

* "This is compelling."
* "Great writing."
* "This section works really well."

Instead explain the mechanism:

"This section works because it moves from an abstract product principle to an
executable assertion, which gives the reader evidence that the framework is
operational rather than rhetorical."

Positive feedback should be reusable knowledge.

The author should leave knowing not only what worked, but why it worked.

## 12. End with a revision strategy

Finish by compressing the feedback into a governing principle for the next
draft.

Examples:

Preserve the distinctions; cut the explanations around them.

Make the mechanism the spine and let the examples carry the proof.

The draft does not need more ideas. It needs stronger hierarchy among the
ideas already present.

When useful, propose a revised rhetorical architecture, but do not automatically
rewrite the piece.

The goal of an editorial review is not to produce a different piece.

It is to make the author's actual idea easier for the reader to see.

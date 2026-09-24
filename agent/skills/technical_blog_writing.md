---
description: >
  Use when drafting, revising, or reviewing technical blog posts whose primary
  goal is to make a system, mechanism, architecture, experiment, or engineering
  idea easy to understand. Optimizes for compressed paragraphs, punchy
  declarative sentences, progressive explanation, and fast movement from
  abstraction to mechanism. This is a specialized explanatory style, not the
  author's default voice. Apply alongside the general writing and voice
  guidelines rather than replacing them.
---

# Technical blog writing

Technical writing should make complicated ideas feel simple without making
them simplistic.

The reader should rarely have to unpack both the concept and the prose at the
same time.

Preserve the author's analytical voice, precision, and interest in underlying
models. Change the presentation: shorter paragraphs, stronger declarative
sentences, clearer sequencing, and faster grounding in concrete mechanisms.

## Core principle

One conceptual move at a time.

A paragraph should usually make one move:

* state a claim;
* explain a mechanism;
* introduce a distinction;
* give an example;
* qualify the previous claim;
* show a consequence;
* transition to the next question.

Do not routinely combine all of these into one paragraph.

Prefer:

The state change constrains the design space.

Unpack shouldn't produce an artifact, so it doesn't get file writes. It also
shouldn't prematurely resolve the thought.

The remaining choices are behavioral.

Over:

The state change constrains the design space: the reply must never become an
artifact, so no file writes, and it must not prematurely resolve the thought.
Product judgment selects the behavioral contract within those constraints.

The underlying reasoning can remain sophisticated. The reader should encounter
it in steps.

## Paragraph rhythm

Default to short paragraphs.

Most paragraphs should contain one to three sentences. A single sentence can
stand alone when it establishes an important claim, distinction, question, or
consequence.

Longer paragraphs are appropriate when an idea genuinely needs continuous
development. Do not mechanically split prose to satisfy a length rule.

Use paragraph breaks as part of the explanation.

A useful rhythm is:

claim

mechanism

implication

Each may be its own paragraph.

The goal is not visual minimalism. The goal is to control how much reasoning
the reader has to hold at once.

## Sentence rhythm

Prefer clear declarative sentences.

Use short sentences for important claims:

Different outputs can all be correct.

The eval passed anyway.

The taxonomy isn't the point.

Then use longer sentences when the relationship between ideas matters:

Research operates on an evidence-backed model of a question, which creates
requirements around provenance, source independence, contradiction handling,
and calibrated uncertainty.

Vary sentence length deliberately.

Avoid a page composed entirely of clipped sentences. Punchiness works because
longer explanatory sentences give the short ones contrast.

As a default:

short sentence → explanation → short consequence

## Put the point first

Readers should know why a paragraph exists before they reach its end.

Prefer:

Requirements don't just tell you what to build. They tell you what not to
build.

Over:

When moving from flows into implementation, there are several ways in which
requirements can affect the decisions being made about the system.

Topic sentences should contain information, not announce that information is
coming.

Avoid:

There are several things worth considering here.

It's important to understand what this means.

Another interesting aspect of this is…

Say the thing instead.

## Move from abstraction to mechanism

Technical concepts become easier to understand when abstractions are quickly
grounded.

Use the sequence:

concept → mechanism → example

For example:

Requirements constrain implementation.

Unpack shouldn't externalize a thought, so it doesn't get file writes. Resume
needs continuity across sessions, so it needs persistent state.

The same design method produces different architecture because the state
transitions are different.

Do not leave an abstract claim floating for several paragraphs before showing
what it means.

When possible, give the reader something inspectable:

* code;
* traces;
* tables;
* examples;
* diagrams;
* inputs and outputs;
* concrete system behavior.

## Explain through questions

A technical section should usually answer one implicit question.

Examples:

* What is actually changing?
* How do state changes become flows?
* What does a flow imply about implementation?
* How do requirements become evals?
* What happens when an eval passes something it shouldn't?

Use headings and transitions to move the reader from question to question.

The overall article should feel like a chain of resolved questions rather than
a sequence of topics.

## Make causality explicit

Technical writing should expose the reasoning chain.

Prefer causal transitions:

Because Unpack shouldn't externalize the thought, it doesn't need file
creation.

That gives us the first set of requirements.

The eval passed anyway.

So the problem wasn't factual accuracy. It was epistemic posture.

Useful transitions include:

* because;
* so;
* which means;
* that gives us;
* from there;
* in practice;
* the result is;
* the problem is;
* this matters because.

Avoid ornamental transitions such as "furthermore," "moreover," and "it is
worth noting" unless they express the relationship more precisely than
ordinary language would.

## Separate claim, qualification, and consequence

Do not overload sentences with every caveat required to make the statement
defensible.

Prefer:

Three runs aren't enough to characterize reliability.

They are enough to show how a failure changes the specification.

Over a sentence that simultaneously makes the claim, supplies its
methodological qualification, anticipates an objection, and explains the
implication.

Qualifications should stay close to the claims they modify, but they do not
need to occupy the same sentence.

This is especially important for the author's natural style, which tends to
preserve the entire logical structure of a thought inside a paragraph.

Keep the logic. Distribute it.

## Use repetition for structure

Strategic repetition can make technical arguments easier to follow.

If a concept is central, reuse its name rather than constantly substituting
synonyms.

For example:

State changes produce flows.

Flows produce requirements.

Requirements constrain implementation.

Evals test those requirements.

Do not vary terminology merely to avoid repetition. In technical writing,
consistent vocabulary usually matters more than lexical variety.

## Name distinctions

When two concepts are easy to conflate, explicitly name the distinction.

Examples:

The problem isn't factual accuracy. It's epistemic posture.

The conversation is the interaction loop. The mental model is the object being
changed.

An outline describes the document. A rhetorical architecture describes how
the reader should change through it.

Good technical writing often advances by creating a useful distinction and
then giving the reader language for it.

Use contrast structures when they sharpen the model:

not X, but Y

X does this; Y does that

the object is X; the interface is Y

Do not overuse them as rhetorical mannerisms.

## Let examples carry explanation

Once an example demonstrates the point, don't repeat the entire argument
afterward.

Prefer:

"Maybe what you're noticing is rhythmic regularity" is a candidate.

"The EU writes its working documents in French first, which explains the
orderliness" is evidence.

Those need different permissions.

The example should do intellectual work.

Afterward, state the consequence and move on.

## Use artifacts when prose becomes inefficient

Do not force prose to represent information that has a clearer form.

Use:

* tables for comparisons, mappings, taxonomies, and repeated structures;
* code for executable or implementation-level behavior;
* diagrams for architecture, flows, and relationships;
* bullets for parallel items when sequence is unimportant;
* numbered steps when sequence is important.

Introduce the artifact with the question it answers. Afterward, explain the
important pattern rather than narrating every cell or line.

## Headings should advance the argument

Prefer headings that state a concept or technical move:

Start with what is changing

Turn state changes into flows

Requirements constrain implementation

Turn requirements into evals

Let behavior refine the design

Avoid generic containers:

Background

Discussion

More considerations

Other thoughts

A reader scanning only the headings should recover the rough argument of the
post.

## Preserve technical precision

Clarity is not simplification by omission.

Do not:

* remove an important caveat because it slows the prose;
* turn a probabilistic claim into a categorical one;
* hide uncertainty;
* collapse technically distinct concepts;
* replace a precise term with a friendlier but incorrect one.

Instead, restructure the explanation so the precision is easier to process.

If a caveat matters, give it its own sentence.

## Preserve the author's voice

This style modifies presentation more than thought.

Keep:

* analytical reasoning;
* explicit models and distinctions;
* first-principles framing;
* causal explanations;
* careful qualification;
* concrete examples;
* understated confidence;
* willingness to show how an idea developed;
* first person when personal implementation or experimentation is relevant.

Avoid turning the author into generic startup or developer-blog voice.

Do not add:

* hype;
* forced cleverness;
* fake informality;
* excessive rhetorical questions;
* canned hooks;
* dramatic claims about how "everything changes";
* unnecessary slang;
* marketing language;
* choppy prose for its own sake.

The desired effect is clearer Alex, not a different author.

## Compression pass

When revising a draft, inspect each paragraph.

Ask:

1. What is the one conceptual move here?
2. Does the first sentence reveal that move?
3. Is the paragraph doing more than one job?
4. Can a qualification become its own sentence?
5. Can an implication become its own paragraph?
6. Is an abstraction grounded quickly enough?
7. Is there a concrete example where the reader needs one?
8. Can a table, code block, or diagram replace explanatory prose?
9. Does the final sentence move the argument forward?
10. Can anything be deleted without losing reasoning?

Then inspect the section.

Ask:

1. What question does this section answer?
2. Does the reader know why that question matters?
3. Does each paragraph follow causally from the previous one?
4. Does the section end once the question has been answered?
5. Does the next heading represent the natural next question?

## Anti-patterns

Flag these during review.

**Logical overpacking.** One paragraph contains the claim, mechanism, caveat,
example, counterargument, and implication.

Fix: preserve the reasoning but distribute it across paragraphs.

**Essay transitions.** "Furthermore, it is important to note that…"

Fix: express the actual relationship. "That creates another problem."

**Delayed point.** A paragraph spends several sentences preparing to say what
it means.

Fix: move the conclusion or distinction to the beginning.

**Abstract stacking.** Several abstract concepts appear before the reader sees
a concrete example.

Fix: ground each important abstraction before introducing the next one.

**Synonym drift.** The same technical concept receives several names for
stylistic variety.

Fix: choose one term and reuse it.

**Qualification nesting.** Parentheticals, subordinate clauses, and caveats
interrupt the main argument.

Fix: promote important qualifications into their own sentences.

**Artificial punchiness.** Every sentence is extremely short.

It feels dramatic rather than clear.

Fix: alternate declarative claims with fuller explanatory sentences.

**Restating the example.** The prose explains a point, gives an example, then
explains the same point again.

Fix: trust the example and state only the new implication.

**Premature detail.** Implementation details appear before the reader has a
model for why they matter.

Fix: establish the conceptual object and mechanism first, then descend the
stack.

## Default article shape

Do not force every post into a template, but a strong technical explanation
often follows this progression:

Problem. What is confusing, missing, or poorly specified?

Model. What is the conceptual frame that makes the problem easier to reason
about?

Mechanism. How does the system actually work?

Concrete case. What happens when the mechanism meets a real input, trace,
experiment, or failure?

Learning. What did the case reveal that the original model missed?

Generalization. What principle transfers beyond this particular
implementation?

This structure works especially well when writing from experiments, agent
traces, evals, or system-design work.

## Review standard

A successful revision should make the piece feel faster without feeling
shallower.

The reader should be able to:

* scan the headings and recover the argument;
* read the first sentence of each paragraph and follow the reasoning;
* understand why each technical detail appears;
* distinguish concepts that are easy to conflate;
* find concrete evidence near abstract claims;
* stop after any section with a coherent model of what was just explained.

The final prose should feel spacious, precise, and inevitable.

Complexity belongs in the idea.

The writing should expose its structure.

---
description: >
  Review technical essays, blog posts, research writing, and product-engineering
  writing for explanatory depth, reasoning quality, structure, and technical
  credibility. Use when the goal is to demonstrate understanding by teaching
  the reader how a system works, why a problem is difficult, how constraints
  shape the solution, and what follows from that reasoning. This skill reviews
  argument and exposition; voice and house style live elsewhere.
---

# Technical writing review

Good technical writing demonstrates understanding rather than announcing it.

The reader should finish with a clearer model of the problem and enough of the author's reasoning to understand why the conclusions follow.

Review for that standard.

## Core principle

Prefer:

observation → mechanism → consequence

over:

claim → assertion → conclusion

For every important claim, ask:

1. What is happening?
2. Why does it happen?
3. What does that imply?

A technically sophisticated fact that does not change the reader's understanding is usually unnecessary. A conclusion whose mechanism has not been explained is usually under-earned.

## Make reasoning reconstructable

The strongest technical writing lets the reader reconstruct the author's judgment.

Prefer arguments of the form:

The system requires A.
A creates constraint B.
B makes the obvious approach C problematic.
D handles B, but introduces E.
Our situation makes E unacceptable.
Therefore we need F.

The exact structure will vary. The principle does not: show the chain of causality.

Do not ask the reader to trust that an architecture, abstraction, or product is good. Give them enough information to see why it exists.

## Structure around a problem

A strong technical essay often moves through:

tension → primitives → obvious approaches → limitations → constraints → architecture → tradeoffs → implications

This is not a mandatory template. Use only the sections the argument needs.

### 1. Establish the tension

Begin with something concrete, surprising, or unresolved.

Prefer a real contradiction or engineering difficulty over a broad thesis.

Weak:

AI is transforming how businesses operate.

Stronger:

Models can search nearly everything a company has written and still fail to understand how the company works.

The opening should create a question the rest of the piece answers.

### 2. Teach the necessary primitives

Descend to the lowest abstraction layer required to understand the problem.

Explain concepts when they become causally relevant.

Do not front-load definitions merely because they are related to the topic.

Ask:

What does the reader need to understand for the next conclusion to feel inevitable?

Explain that, then continue.

### 3. Take obvious solutions seriously

When an intuitive solution exists, present it in its strongest reasonable form.

Explain:

* why someone would choose it;
* what it solves;
* where it works;
* what constraint eventually causes it to fail.

Avoid straw men. A failed approach should usually seem reasonable before its limitation becomes visible.

### 4. Find the governing constraints

Look for the small number of properties the architecture cannot ignore.

These are often more important than the eventual solution.

Examples:

* latency must remain local;
* writes must be durable;
* relationships must survive retrieval;
* state changes over time;
* consistency matters more than throughput.

Once these constraints are clear, the design should begin to feel derived rather than invented.

### 5. Derive the solution

Introduce the author's architecture, framework, or product only after the reader understands why it is needed.

Prefer:

Given these constraints, we need…

over:

We built…

Each major component should answer a previously established constraint.

If a component appears without a reason for existing, either establish the constraint or remove the detail.

### 6. Attack the solution

Credibility increases when the author understands where their own abstraction breaks.

Look for:

* tradeoffs;
* failure modes;
* operational complexity;
* assumptions;
* edge cases;
* unresolved questions;
* circumstances where another approach is better.

Do not add caveats performatively. Include limitations that materially change how the system should be understood.

### 7. Zoom back out

After resolving the technical problem, explain what the mechanism means at a larger level.

Move from:

how it works

to:

why this matters

The larger implication should emerge from the technical argument rather than replace it.

## Paragraph mechanics

A strong explanatory paragraph often follows:

statement → mechanism → implication → next question

Example:

Business context isn't a collection of documents. Documents are artifacts produced by a business: proposals, emails, contracts, meeting notes, and tickets. The business itself consists of the entities, relationships, decisions, constraints, and processes that produced them. That distinction matters when we ask an agent to do something rather than simply find something.

The next paragraph can now naturally ask:

So how should we represent a business?

Each paragraph should create pressure for the next one.

## Follow the "so what?" chain

For every technical detail, ask:

So what?

Continue until the consequence relevant to the argument becomes clear.

If:

X is content-addressed.

Ask:

So what does that enable or constrain?

If:

Traversal is sequential.

Ask:

What does that imply for remote storage?

If:

Remote traversal creates network round trips.

Ask:

What does that imply for the architecture?

This prevents the essay from becoming a collection of technically correct but rhetorically inert facts.

## Prefer mechanisms to adjectives

Avoid using adjectives as substitutes for explanation.

Weak:

This is a powerful and scalable architecture.

Better:

Any node can service a request because durable state lives outside the process.

Weak:

Business context is complex.

Better:

A customer's status may depend simultaneously on a contract, three conversations, an unresolved support ticket, and a decision that was never written down.

Show the property that earns the adjective.

## Distinguish layers of abstraction

Watch for arguments that accidentally jump between:

* data;
* representation;
* storage;
* retrieval;
* reasoning;
* application behavior;
* user experience.

A claim at one layer does not automatically establish a claim at another.

For example:

The model can retrieve the document.

does not imply:

The model understands the business state represented by the document.

When the essay moves between layers, make the transition explicit.

## Use examples as proofs

Examples should test or reveal an abstraction, not merely decorate the prose.

Prefer concrete examples that make the mechanism visible.

A good example should allow the reader to think:

Ah. Now I see why that breaks.

After the example, return to the general principle.

example → observation → generalization

## Technical credibility

Technical authority should come from precision.

Prefer:

* specific mechanisms;
* concrete constraints;
* real failure modes;
* explicit assumptions;
* measured evidence where available.

Avoid:

* unnecessary jargon;
* unexplained acronyms;
* exhaustive taxonomies;
* name-dropping technologies;
* complexity used as evidence of sophistication.

The goal is not to make the system sound complicated.

The goal is to make the complicated system understandable.

## Tone

Aim for:

technically authoritative + conversational + curious + intellectually generous

The author should sound like someone who understands the system well enough to explain it simply.

Use occasional personality, humor, or informality where natural. Do not manufacture irreverence.

Avoid:

* corporate marketing language;
* academic stiffness;
* breathless futurism;
* self-congratulation;
* excessive certainty;
* "thought leadership" abstractions unsupported by mechanisms.

Let technical understanding create authority.

## Product writing

When the essay relates to something the author has built, resist introducing the product too early.

Prefer:

problem → reasoning → constraints → solution → product

over:

product → features → justification

Ideally the reader understands why something like the product should exist before being told that it does.

The product then feels like the consequence of the argument rather than an interruption from marketing.

## Review procedure

When reviewing a draft, first identify:

The question
What question is the essay actually trying to answer?

The tension
Why is that question non-obvious?

The causal chain
What sequence of mechanisms leads to the conclusion?

The constraints
What facts make some solutions viable and others unsuitable?

The insight
What should the reader understand afterward that they probably did not understand before?

The evidence
Which claims are demonstrated, measured, sourced, or concretely illustrated?

The tradeoffs
Where does the proposed model or architecture stop working?

The implication
Why does the technical argument matter beyond itself?

If any of these cannot be identified, flag the gap.

Fact-check the load-bearing claims. Identify the few claims the argument
actually depends on — numbers, benchmarks, citations, described behavior of
tools or APIs — and verify each with `web_search` or `web_fetch` before the
review calls it unsupported. Report what was checked and what was not: a
claim the author measured stays qualified as measured, and a claim that could
not be verified is flagged as unverified rather than wrong. Do not
fact-check decorative details; do not substitute search results for the
author's first-hand experience.

## Revision priorities

Prioritize revisions in this order:

1. Reasoning — Are the conclusions actually supported?
2. Structure — Does each section create the need for the next?
3. Mechanism — Does the reader understand why things happen?
4. Specificity — Are abstractions grounded in concrete systems or examples?
5. Compression — Can anything be removed without losing understanding?
6. Language — Can sentences become clearer or more precise?
7. Personality — Does the prose sound natural rather than generic?

Do not polish sentences whose underlying argument still needs work.

## Review output

Do not rewrite the entire piece by default.

Return:

### Overall read

Briefly describe what the piece is trying to establish and whether its reasoning currently lands.

### Argument map

Reduce the draft to its causal structure:

A → B → C → therefore D

This should reveal missing links immediately.

### Strongest sections

Identify where the author successfully teaches through mechanism, constraints, examples, or tradeoffs.

Explain why those sections work.

### Weakest links

Identify places where:

* conclusions arrive too early;
* mechanisms are missing;
* abstractions replace explanations;
* technical details lack a "so what";
* examples fail to prove the point;
* the product appears before its necessity is established;
* the argument jumps between layers;
* claims exceed the evidence.

Prioritize structural problems over sentence-level preferences.

### Recommended changes

Give a small number of high-leverage revisions.

Prefer:

Establish why retrieval loses relational information before introducing the representation layer.

over:

Rewrite section three.

### Line-level notes

Only after the argument is sound, flag sentences that are vague, inflated, repetitive, awkward, or unnecessarily technical.

When suggesting a replacement, preserve the author's underlying voice rather than imitating another writer.

### House-style audit

Separate from the content review: audit the piece against the `house-style`
skill and report every violation. Quote the span that violates a rule and name
the rule; group violations by rule with counts. If none, report "house-style
clean". This section reports facts, not preferences — it never regrades the
content scores and never questions the author's structure, examples, or
position.

## Final test

Before approving a technical essay, ask:

Does this piece merely tell me what the author believes, or does it let me see why they believe it?

The latter is the standard.

The reader should come away thinking:

"I understand this problem differently now."

Not:

"This author wanted me to know they are smart."

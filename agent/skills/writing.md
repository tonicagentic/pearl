---
description: >-
  Load before producing publishable prose: blog posts, essays, announcements,
  narratives, or any writing meant for readers other than the user. Defines
  the universal bar for good writing (worthwhile ideas, clear argument,
  rhetorical structure, evidence, specificity, compression, trustworthy
  persuasion) plus the style constraints and editing order. Use when drafting,
  structuring, or substantively revising a piece.
---

# Writing best practices

Good writing gives the reader something worth understanding, makes it easy to understand, and gives them good reason to believe it.

The goal is not to sound smart. It is to make the reader feel smarter.

## 1. Have something to say

Prose cannot rescue a thin idea.

Before writing, identify the thing the reader should understand differently afterward.

The useful-writing test is a good bar:

- True: you believe it, and the evidence supports it.
- Important: understanding it changes something that matters.
- Novel: it adds a fact, distinction, explanation, or framing the reader probably did not already have.
- Strong: it says as much as can be said without becoming false.

The four work together. True but obvious is forgettable. Novel but false is rhetoric without substance. Important but vague is not useful.

Ask: what becomes easier to see after reading this?

Strong ideas often come from a distinction ("these look like the same thing, but they are not"), a mechanism ("we observe X because Y is happening underneath it"), or a reclassification ("we thought this was an X problem; it was really a Y problem").

Do not force novelty. Naming something familiar precisely can be more useful than being surprising.

## 2. Make one argument

Every piece needs a center of gravity.

State the central idea in one sentence before drafting. Every section should either establish it, explain it, test it, complicate it, or show its consequence.

A useful reasoning arc is: observation → question → claim → mechanism → evidence → implication. Not every piece needs every step or that exact order. But the reader should be able to answer:

1. What are you claiming?
2. Why do you think it is true?
3. Why does it matter?

If two ideas compete for the center, split the piece or decide which explains the other.

## 3. Use rhetoric to reveal the idea

Rhetoric should increase the resolution of the argument, not compensate for a weak one.

**Logos: give me a reason to believe it.** The default appeal. Use causal explanation, evidence, examples, numbers, comparisons, distinctions, counterexamples, explicit reasoning. Do not merely state that X causes Y; show the mechanism connecting them. Prefer "the agent improved because retrieval narrowed the context before generation" over "retrieval significantly improved agent performance". When the argument is technical, analytical, or controversial, logos should carry most of the weight.

**Ethos: give me a reason to trust you.** Build credibility through evidence of judgment, not assertions of authority. Ethos comes from showing what you actually observed, being specific about what you did, distinguishing evidence from inference, admitting relevant limits, acknowledging an earlier assumption that proved wrong, representing opposing arguments fairly, and saying "I don't know" when you do not know. Prefer "we saw this across three implementations" over "as experts in agentic systems, we know". Competence is more persuasive when demonstrated than announced.

**Pathos: give me a reason to care.** Use emotion to establish stakes, not to manipulate judgment. The strongest pathos comes from concrete consequences: "a developer now has to approve 40 decisions that used to happen implicitly" rather than "developers are drowning in an overwhelming wave of AI complexity". Let the reader feel the significance rather than telling them how significant it is.

Default order: logos establishes the claim, ethos makes it trustworthy, pathos makes its importance felt. For technical and intellectual writing, pathos should usually be the lightest touch.

## 4. Create tension

Readers keep reading because something remains unresolved. Useful forms:

- Expectation vs. observation: "We expected the larger model to perform better. It didn't."
- Two desirable things in conflict: "More context gives the agent more information, but also more opportunities to attend to the wrong thing."
- Appearance vs. mechanism: "It looked like a reasoning failure. The model never had the information required to reason correctly."
- A question the piece genuinely resolves.
- Before vs. after: "The first version required twelve decisions. The second required two."

Tension is not clickbait. It is the gap the argument genuinely resolves. Do not manufacture suspense by withholding information the reader needs.

## 5. Move between abstract and concrete

Abstraction gives an idea reach. Concrete detail gives it meaning. Move deliberately: example → pattern → principle, or principle → example → consequence.

Never leave an important abstraction without an anchor. Prefer anchors in roughly this order:

1. observation
2. number
3. worked example
4. before/after
5. minimal scenario
6. analogy
7. metaphor

Use analogy to clarify structure, not decorate prose. If the mapping breaks, drop the analogy.

## 6. Make the reader do less work

Clarity is partly information architecture. Put related ideas together. Introduce concepts before depending on them. Make references unambiguous. Give the reader the information required to understand sentence B before sentence B arrives.

Prefer claim → mechanism → implication over a paragraph that makes the reader reconstruct the relationship. Use transitions when the relationship is not obvious: but, because, so, instead, in practice, the difference is, this matters because. Transitions should encode logic, not merely announce movement.

## 7. Control emphasis

Not every sentence deserves equal weight. Give the strongest idea the cleanest sentence.

Use sentence length, paragraph breaks, ordering, contrast, intentional repetition, concrete detail, and occasional parallel structure to tell the reader what matters. A short sentence after a complex explanation creates emphasis: "The model had enough information. It did not know what mattered."

Use this sparingly. If every sentence is a punchline, none is.

Repeat an idea only when repetition changes its function: establishing a pattern, creating rhythm, or returning to an earlier idea with new meaning. Bad repetition says the thesis three ways because the writer does not trust the first one. State the sharpest version and move forward.

## 8. Prefer precision to intensity

Strong writing does not need strong-sounding words. Replace evaluation with evidence.

Not "a powerful new architecture" but "an architecture that lets every agent operate on the same underlying objects". Not "dramatically faster" but "4.2 seconds instead of 11".

Specificity creates credibility and emphasis at the same time. Use adjectives when they add information; remove them when they merely tell the reader how impressed to be.

## 9. Qualify precisely

Confidence means matching the strength of the sentence to the strength of the evidence. Distinguish observed, measured, inferred, hypothesized, cited, and illustrative.

"This proves X" is not stronger writing when the evidence only suggests X. It is less trustworthy writing.

Good qualification narrows the claim: "in the systems we tested", "one explanation is", "this suggests", "I suspect". Bad qualification obscures it: "it could perhaps be argued that".

Make the strongest claim you can defend, then stop.

## 10. Anticipate the intelligent objection

A good argument knows where it is weakest. Ask:

- What assumption is this resting on?
- What is the strongest reasonable alternative explanation?
- Where would this stop being true?
- What evidence would change my mind?

Address the objection that helps define the claim. Do not litter the piece with defenses against every imaginable criticism. A qualification is useful when it increases precision, not when it merely makes disagreement harder.

When representing another position, state it in a form its proponents would recognize before responding to it.

## 11. Write sentences that disappear

The reader's attention belongs on the thought.

Prefer ordinary language, concrete nouns, and active verbs. Use the precise technical word when it reduces ambiguity. Do not use a sophisticated word merely because it raises the register.

Vary sentence length. A longer sentence can establish a relationship; a short one can resolve it. Read prose aloud. Rewrite anything that sounds written rather than spoken.

Do not confuse simplicity with shallowness. The goal is to make complicated thinking easy to follow without pretending it is simple.

## 12. Compress without flattening

Remove anything that does not improve: meaning, evidence, reasoning, rhythm, necessary qualification, orientation.

Cut throat-clearing, redundant examples, repeated conclusions, unnecessary transitions, and sentences that merely announce what the next sentence will do. Preserve the reasoning the reader needs to reach the conclusion.

The target is not minimum length. It is minimum friction at full fidelity.

## 13. Open where the idea becomes interesting

Do not warm up on the page.

Useful openings: an observation, a tension, a surprising result, a concrete scene, a consequential question, an assumption the piece will complicate.

Avoid generic context ("AI is changing the way we work"). Prefer the actual problem ("giving an agent more context can make it less reliable").

The opening makes a promise. The body must fulfill it.

## 14. End one level higher

Do not end by summarizing what the reader just read.

A strong ending gives the argument its final consequence: finding → principle, example → generalization, answer → better question, observation → changed interpretation. The ending should feel earned by everything before it. Do not add profundity after the argument has already ended.

## 15. Style constraints

- No em dashes.
- Oxford comma.
- Straight quotes and apostrophes.
- Active voice by default.
- Content headings, not generic labels.
- Exclamation points rarely.
- Metaphor sparingly.
- No engagement bait, manufactured contrarianism, fake certainty, corporate or motivational filler, or hype where specificity can do the work.

Avoid words such as "revolutionary", "game-changing", "powerful", "robust", "seamless", "cutting-edge", "supercharge", "unlock", "leverage", and "optimize" when they substitute evaluation for explanation.

## Editing

Edit in this order:

1. **Idea.** Is there something worth saying?
2. **Argument.** Can the central claim be stated in one sentence? Does the reasoning actually support it?
3. **Evidence.** Are claims grounded and correctly scoped?
4. **Rhetoric.** Does the reader understand why this is true, why you are credible, and why it matters?
5. **Structure.** Does each paragraph create forward movement?
6. **Concrete detail.** Can the reader see what the abstractions refer to?
7. **Precision.** Can vague evaluations become mechanisms, numbers, names, or examples?
8. **Objections.** Is there a reasonable alternative or limit that would sharpen the argument?
9. **Compression.** What can disappear without losing meaning?
10. **Rhythm.** Does it sound natural aloud?
11. **Ending.** Did the piece stop when the thought was complete?

## Final test

A publishable piece should leave the reader with at least one of:

- "I didn't know that."
- "I hadn't separated those things before."
- "That explains something I've noticed."
- "That's a useful way to think about it."
- "I can use that."

The writing succeeds when the reader remembers the idea more clearly than they remember the writing.

## Collaborative drafting

When someone brings a piece to work on conversationally (a blog post, essay, memo, announcement), treat the conversation as the writing desk:

- Understand before drafting. Learn the piece's purpose, audience, and central claim before producing publishable prose. Ask focused questions (one or two, not an interrogation) or state your working assumptions and invite correction. For a rough idea, engage with the idea itself: name the strongest version of the claim, or the tension it could turn on, rather than immediately dumping polished prose.
- Make one argument per piece. If the user's idea contains two competing centers of gravity, say so and help pick or split.
- Revise faithfully across turns. Apply the feedback exactly; preserve accepted content the user approved in earlier turns (structure, numbers, examples, voice choices) unless they ask to change it. When new feedback conflicts with an earlier decision, flag the conflict and confirm rather than silently switching.
- Keep the thread. Refer back to the piece's central claim when weighing a change: does this edit sharpen the argument, or just change it?
- Show, then explain only if asked. Return clean prose by default; the editing rules in the agent instructions govern what surrounds a draft.

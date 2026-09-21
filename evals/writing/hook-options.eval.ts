import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";

// A deliberately flat intro. The partner diagnoses it and offers distinct
// alternatives in the author's voice (content-research-writer skill, step 4).
const WEAK_HOOK = `Product management is changing because of AI. In this
article, I'll discuss some ways AI affects product managers and what they
should do about it.`;

export default defineEval({
  description:
    "Hook improvement: a flat intro returns multiple distinct rewrite options in the author's voice, with a diagnosis of the original.",
  tags: ["smoke"],
  async test(t) {
    const turn = await t.send(
      `Here's my introduction. Help me make the hook more compelling:\n\n${WEAK_HOOK}`,
    );

    t.succeeded();

    const reply = turn.message ?? "";
    t.check(
      reply.length,
      satisfies((length: number) => length > 200, "the reply delivers the analysis and the options"),
    );

    t.judge.autoevals
      .closedQA(
        "The reply offers at least two genuinely distinct hook alternatives using different strategies (for example a concrete data beat, a question, a short story) — not one rewrite restated three ways. Each alternative is specific and concrete (numbers, a scene, or a sharp question), not abstract advice about what a hook should do.",
        { on: reply },
      )
      .atLeast(0.8);

    t.judge.autoevals
      .closedQA(
        "The reply briefly diagnoses the original (what works, what is weak: generic opener, no stakes, no promise) and the alternatives sound like the practitioner author rather than marketing copy: concrete, plain, specific to the craft. The suggested lines follow house style: no em dashes, no hype vocabulary (revolutionary, game-changing, seamless, unlock, leverage).",
        { on: reply },
      )
      .atLeast(0.7);
  },
});

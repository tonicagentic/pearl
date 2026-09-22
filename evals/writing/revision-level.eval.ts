import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";

// Phase 3 (docs/content-parity-plan.md): feedback names the level where the
// problem exists — an awkward sentence that exists because the paragraph
// argues before the reader has the mechanism is an argument-level finding,
// not a sentence-level one.
const SECTION = `## Why teams regret self-hosting

The decision to self-host is, in my view, the correct one for any team that
values long-term flexibility, and honestly the writing of this section could
be tightened up later, but the reasoning is what matters most here. Teams
that self-host end up happier because owning your infrastructure gives you
flexibility, and flexibility is what makes teams happy. After we moved, the
team was happier, which proves the point. There are many considerations on
both sides of this question.`;

export default defineEval({
  description:
    "Revision levels: feedback on a section whose real problem is at the argument level (circular support, asserted conclusion) diagnoses the argument-level root and prioritizes it over the sentence-level nitpick, naming the level.",
  tags: ["smoke"],
  async test(t) {
    const turn = await t.send(
      `I just finished this section. Review it and give feedback:\n\n${SECTION}`,
    );

    t.succeeded();
    const reply = turn.message ?? "";
    t.check(
      reply.length,
      satisfies((length: number) => length > 150, "the reply carries real feedback"),
    );

    t.judge.autoevals
      .closedQA(
        "The feedback diagnoses the argument-level root problem: the section's support is circular ('teams that self-host are happier because owning infrastructure gives flexibility, and flexibility is what makes teams happy') and the conclusion is asserted rather than demonstrated ('which proves the point' proves nothing — one anecdote is not evidence). It presents this as the primary, higher-level finding and does not lead with or fixate on the sentence-level awkwardness. If it mentions the sentence at all, it is secondary, or used as the doorway into the deeper problem.",
        { on: reply },
      )
      .atLeast(0.8);

    t.judge.autoevals
      .closedQA(
        "The feedback names the level or depth where each problem exists (argument-level versus sentence-level, in those words or clearly equivalent language), rather than presenting all issues as an undifferentiated list. It also states how deep the intervention needs to go (the fix requires restructuring the support, not rewording), and does not simply rewrite the paragraph unprompted.",
        { on: reply },
      )
      .atLeast(0.7);
  },
});

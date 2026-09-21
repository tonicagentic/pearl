import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";

// Incremental section feedback: the author is mid-draft and wants a partner,
// not a rewriter (content-research-writer skill, steps 5-6).
const SECTION = `## Common Mistakes

Many teams adopt AI tools without a plan. They buy licenses, run a workshop,
and wonder why nothing changed. The problem is not the tools. The problem is
that nobody changed what the team measures. Teams also tend to pilot with
their most skeptical engineers, which guarantees a lukewarm result. Finally,
most teams evaluate tools on individual productivity instead of cycle time,
so the pilot succeeds on vibes and fails on evidence.`;

export default defineEval({
  description:
    "Section feedback: incremental feedback on a mid-draft section pairs every critique with a concrete quoted fix, names what works, and ends with a next step instead of rewriting the section.",
  tags: ["smoke"],
  async test(t) {
    const turn = await t.send(
      `Just finished my "Common Mistakes" section. Review it and give feedback:\n\n${SECTION}`,
    );

    t.succeeded();

    const reply = turn.message ?? "";
    t.check(
      reply.length,
      satisfies((length: number) => length > 200, "the reply carries real feedback"),
    );

    t.judge.autoevals
      .closedQA(
        "The feedback is specific and incremental: it identifies concrete weaknesses (for example the unquantified claims that need numbers or examples, the missing evidence, the flat list order) and pairs each with a suggested rewrite that quotes or closely tracks the draft. Generic advice like 'add more detail' or 'make it pop' fails.",
        { on: reply },
      )
      .atLeast(0.8);

    t.judge.autoevals
      .closedQA(
        "The feedback also names what works, offers suggestions rather than directives, and ends with a question or a next step rather than a verdict. It does not rewrite the whole section unprompted. Suggested lines keep the author's plain practitioner voice and follow house style: no em dashes, no hype vocabulary.",
        { on: reply },
      )
      .atLeast(0.7);
  },
});

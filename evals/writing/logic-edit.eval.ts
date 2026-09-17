import { defineEval } from "eve/evals";

// A draft whose argument chain is broken: the conclusion does not follow from
// the evidence, and one claim is asserted without support.
const BROKEN_LOGIC_DRAFT = `Why we should switch to the new billing vendor by March:

Our current vendor's dashboard is ugly. Everyone complains about it. Last
quarter we lost two days of finance time to manual invoice reconciliation.

Also our current contract auto-renews in March.

Therefore switching vendors will save us money and make customers happier.
I've already told one customer it's happening.`;

export default defineEval({
  description:
    "Logic edit: repair a broken argument chain and flag unsupported claims instead of papering over them.",
  tags: ["smoke"],
  async test(t) {
    const turn = await t.send(
      `The argument in this doesn't hold together. Fix the logical flow and flag anything that's claimed without support — I want the reasoning to actually work:\n\n${BROKEN_LOGIC_DRAFT}`,
    );

    t.succeeded();
    t.usedNoTools();

    t.judge.autoevals
      .closedQA(
        "The edit identifies or repairs the logical gaps: an ugly dashboard does not by itself imply cost savings, there is no evidence switching saves money or improves customer happiness, the March auto-renewal is a deadline/leverage point rather than a reason itself, and promising a customer before a decision is made is a risk. The revised draft's conclusion is now supported by its premises or clearly marked as needing evidence.",
        { on: turn.message },
      )
      .atLeast(0.8);

    t.judge.autoevals
      .closedQA(
        "The response is honest about weaknesses in the original argument rather than diplomatically rewording them — it tells the author what does not follow and why.",
        { on: turn.message },
      )
      .atLeast(0.7);
  },
});

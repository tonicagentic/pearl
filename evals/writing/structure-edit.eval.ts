import { defineEval } from "eve/evals";

// A deliberately messy draft: the headline news is buried in the middle,
// there is no clear opening, and a tangent interrupts the flow.
const MESSY_DRAFT = `hey team

so we shipped the export feature last week, you might have seen the changelog.
it supports csv and json. pdf is coming later, we haven't started it.

random aside: the office coffee machine is fixed.

the reason this matters is that three of our biggest accounts have been asking
for it since january and two of them were blocking renewal on it. also it
reduces the manual work our support team does every week by something like 5
hours total.

if you find bugs, ping me directly.

also the export respects the new permissions model we rolled out, which took a
while but was the right call.

- sam`;

export default defineEval({
  description:
    "Structure edit: reorganize a scattered draft so the important news leads, without changing meaning.",
  tags: ["smoke"],
  async test(t) {
    const turn = await t.send(
      `Here's an update I wrote for my team. It's all over the place — reorganize it so the most important news leads and related things sit together. Don't change my meaning, don't add anything new:\n\n${MESSY_DRAFT}`,
    );

    t.succeeded();
    t.usedNoTools();

    t.judge.autoevals
      .closedQA(
        "The reorganized draft leads with the export feature being shipped (the key news), groups related points together (permissions detail with the feature, coffee machine aside separated or dropped), and preserves every factual claim from the original (csv/json support, pdf not started, three accounts asking since January, two blocking renewal, ~5 hours weekly support savings, ping sam for bugs).",
        { on: turn.message },
      )
      .atLeast(0.8);

    t.judge.autoevals
      .closedQA(
        "The reorganization did not invent new facts, feature details, or claims that were not in the original draft.",
        { on: turn.message },
      )
      .atLeast(0.8);
  },
});

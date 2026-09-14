import { defineEval } from "eve/evals";

export default defineEval({
  description:
    "Opinions and general knowledge: the agent answers directly and does not waste searches.",
  tags: ["smoke"],
  async test(t) {
    const turn = await t.send(
      "Do you think pineapple belongs on pizza? Give me your take.",
    );

    t.succeeded();
    t.usedNoTools();
    t.notCalledTool("web_search");
    t.notCalledTool("exa_agent_run");

    t.judge.autoevals.closedQA(
      "The answer engages with the question conversationally and shares an actual opinion or playful take.",
      { on: turn.message },
    );
  },
});

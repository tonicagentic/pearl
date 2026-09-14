import { defineEval } from "eve/evals";

export default defineEval({
  description:
    "Small talk: the agent answers conversationally and does not reach for tools.",
  tags: ["smoke"],
  async test(t) {
    const turn = await t.send(
      "Tell me one surprising fun fact about octopuses.",
    );

    t.succeeded();
    t.usedNoTools();
    t.maxToolCalls(0);

    t.judge.autoevals.closedQA(
      "The reply is conversational, shares one interesting fact about octopuses, and stays brief (no tool output padding).",
      { on: turn.message },
    );
  },
});

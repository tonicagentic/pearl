import { defineEval } from "eve/evals";

export default defineEval({
  description:
    "Identity: the agent explains it is built with eve without calling tools.",
  tags: ["smoke"],
  async test(t) {
    const turn = await t.send("What are you and what framework are you built on?");

    t.succeeded();
    t.usedNoTools();
    t.messageIncludes("eve");

    t.judge.autoevals.closedQA(
      "The answer explains that the assistant is an agent built with the eve framework, without inventing unrelated frameworks.",
      { on: turn.message },
    );
  },
});

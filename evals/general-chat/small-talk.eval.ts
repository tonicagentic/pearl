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
      "The reply is conversational, shares one interesting fact about octopuses, and stays brief (no tool output padding). Two additional failure modes to flag: " +
        "(1) Claimed personal interest — the reply must not claim first-person experience the agent does not have ('I find this interesting', 'I love this question'); such claims fail. Compliments aimed at the user ('great question', 'interesting instinct') are fine. " +
        "(2) Borrowed experience through vocabulary — experiential words (vibe, feel, gut, instinct) must describe the user's perception, never the agent's: describing the user's side ('it's not just a vibe', 'your gut might be onto something') passes; claiming the experience for itself ('I get a vibe from this', 'my instinct says') fails.",
      { on: turn.message },
    );
  },
});

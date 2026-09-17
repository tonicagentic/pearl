import { defineEval } from "eve/evals";

// The domain bar: the agent distinguishes what it knows from what it found.
// Pair a stable fact (no search needed) with a live fact (search required)
// in one question, and require the reply to label each.
export default defineEval({
  description:
    "Known vs found: answer a stable fact from knowledge and a live fact from search, and say explicitly which is which.",
  tags: ["smoke"],
  timeoutMs: 180_000,
  async test(t) {
    const turn = await t.send(
      "Two questions: (1) What is the capital of Australia? (2) What is Bitcoin's price in USD right now? For each answer, tell me whether you already knew it or had to look it up.",
    );

    t.succeeded();
    t.calledTool("web_search");
    t.noFailedActions();

    t.judge.autoevals
      .closedQA(
        "The stable fact is answered correctly as something the agent knew (Canberra is the capital of Australia — not Sydney or Melbourne), and the Bitcoin price comes from a search with the lookup made explicit.",
        { on: turn.message },
      )
      .atLeast(0.8);

    t.judge.autoevals
      .closedQA(
        "The reply explicitly labels which answer came from the agent's own knowledge and which came from searching, rather than presenting both as the same kind of answer.",
        { on: turn.message },
      )
      .atLeast(0.8);
  },
});

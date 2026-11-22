import { defineEval } from "eve/evals";

export default defineEval({
  description:
    "“What’s going on with X this week?” — get a short answer with sources from search.",
  tags: ["smoke"],
  timeoutMs: 180_000,
  async test(t) {
    const turn = await t.send(
      "What's been happening this week with AI regulation in the EU? " +
        "Give me the short version and cite where each item came from.",
    );

    t.succeeded();
    turn.calledTool("web_search");
    turn.noFailedCalls();

    t.judge(
        "The answer covers recent EU AI-regulation developments that plausibly " +
          "match the current week or month, and attributes items to identifiable " +
          "sources (numbered links or named outlets) rather than bare claims.",
        { on: turn.reply },
      )
      .label("answer-with-sources")
      .atLeast(0.8);
  },
});

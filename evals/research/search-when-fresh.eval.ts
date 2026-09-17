import { defineEval } from "eve/evals";

// Unlike web-lookup/current-facts (which explicitly tells the agent to use
// web search), this eval tests unprompted tool selection: a fast-changing
// question where searching is obviously the right move, with citations.
export default defineEval({
  description:
    "Search when fresh: unprompted search for a fast-changing topic, with per-story citations.",
  tags: ["smoke"],
  timeoutMs: 180_000,
  async test(t) {
    const turn = await t.send(
      "What's been happening this week with AI regulation in the EU? Give me the short version and tell me where each item came from.",
    );

    t.succeeded();
    t.calledTool("web_search");
    t.noFailedActions();

    t.judge.autoevals
      .closedQA(
        "The answer covers recent EU AI-regulation developments (e.g., AI Act implementation, enforcement, guidance) that plausibly match the current week or month, and attributes each news item to a source.",
        { on: turn.message },
      )
      .atLeast(0.8);

    t.judge.autoevals
      .closedQA(
        "News items are attributed to identifiable sources rather than stated as bare unsupported claims.",
        { on: turn.message },
      )
      .atLeast(0.8);
  },
});

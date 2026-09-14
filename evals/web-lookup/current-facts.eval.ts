import { defineEval } from "eve/evals";

export default defineEval({
  description:
    "Current facts: the agent uses web_search for a fast-changing fact and cites a source.",
  tags: ["smoke"],
  timeoutMs: 180_000,
  async test(t) {
    const turn = await t.send(
      "Use web search to find the current stable version of Next.js and cite the source.",
    );

    t.succeeded();
    t.calledTool("web_search");
    t.noFailedActions();

    t.judge.autoevals.closedQA(
      "The answer states a specific recent Next.js version number and references a source (URL or site name) it searched.",
      { on: turn.message },
    );
  },
});

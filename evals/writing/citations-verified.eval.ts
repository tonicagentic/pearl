import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";

// Research for a citable claim: findings must carry real attributed sources,
// and thin evidence must be reported as thin (content-research-writer skill,
// step 3; the research suite's no-fabrication bar at writing-partner depth).
export default defineEval({
  description:
    "Research with citations: the agent searches the web, returns findings tied to real named sources, and reports thin or contested evidence honestly.",
  tags: ["smoke"],
  async test(t) {
    const turn = await t.send(
      "I'm writing a section claiming that AI coding assistants speed up feature work. Research this and give me citable data with sources.",
    );

    t.succeeded();
    t.calledTool("web_search");

    const reply = turn.message ?? "";
    t.check(
      reply.length,
      satisfies((length: number) => length > 200, "the reply carries the findings, not a pointer"),
    );

    t.judge.autoevals
      .closedQA(
        "The reply presents concrete findings (statistics, studies, or expert statements) each tied to a named source with publication and year where available. Every source is a real, verifiable publication or organization: no invented studies, fabricated quotes, or made-up numbers. Where evidence is thin, dated, or contested, the reply says so instead of papering over it.",
        { on: reply },
      )
      .atLeast(0.8);
  },
});

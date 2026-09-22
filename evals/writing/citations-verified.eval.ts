import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";

// Research for a citable claim: findings must carry real attributed sources,
// and thin evidence must be reported as thin (content-research-writer skill,
// step 3; the research suite's no-fabrication bar at writing-partner depth).
export default defineEval({
  description:
    "Research with citations: the agent gathers citable data (inline web_search or the researcher subagent) with real attributed sources, and reports thin or contested evidence honestly.",
  tags: ["smoke"],
  async test(t) {
    const turn = await t.send(
      "I'm writing a section claiming that AI coding assistants speed up feature work. Research this and give me citable data with sources.",
    );

    t.succeeded();
    // Either path is correct: an inline search, or the researcher subagent
    // (instructions.md routes source-gathering there to keep the drafting
    // context clean).
    t.check(
      turn.toolCalls.some(
        (call) => call.name === "web_search" || call.name === "researcher",
      ),
      satisfies(Boolean, "the agent researched inline or delegated to the researcher"),
    );

    const reply = turn.message ?? "";
    t.check(
      reply.length,
      satisfies((length: number) => length > 120, "the reply carries findings or a legible research handoff"),
    );

    t.judge.autoevals
      .closedQA(
        "The reply either presents concrete findings (statistics, studies, or expert statements) each tied to a named source with publication and year where available, or delegates the research with a framing that will produce verifiable findings and says the results land in this thread. In both cases: no invented studies, fabricated quotes, or made-up numbers; sources are real, verifiable publications or organizations; where evidence is thin, dated, or contested, the reply says so.",
        { on: reply },
      )
      .atLeast(0.8);
  },
});

import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";

// Research-heavy writing: source-gathering is delegated to the researcher
// subagent so the drafting context stays clean, and the thread says what is
// being gathered and when it lands.
export default defineEval({
  description:
    "Research delegation: a research-heavy content request is delegated to the researcher subagent, and the thread states what is being gathered and that findings land here.",
  tags: ["smoke"],
  async test(t) {
    const turn = await t.send(
      "I'm writing a case study on teams that moved from serverless back to self-hosted infrastructure for cost reasons. Gather real examples with numbers before I outline — I want at least three verifiable cases.",
    );

    t.succeeded();
    t.calledTool("researcher");

    const reply = turn.message ?? "";
    t.check(
      reply.length,
      satisfies((length: number) => length > 80, "the thread explains the research handoff"),
    );

    t.judge.autoevals
      .closedQA(
        "The thread makes the research handoff legible: it says what is being gathered (real migration examples with numbers), frames the search so the findings will be verifiable, and says the results land in this thread. It does not fabricate examples or numbers inline instead of delegating, and it does not claim the research is already done.",
        { on: reply },
      )
      .atLeast(0.8);
  },
});

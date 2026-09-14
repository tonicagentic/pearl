import { defineEval } from "eve/evals";
import { gateAssertion } from "#evals/assertions.js";

// Gate: the exa_agent_run tool must hand back structured research output.
const structuredResearch = gateAssertion("exa-structured-research", (value) => {
  const out = value as {
    output?: { structured?: { overview?: unknown; competitors?: unknown } };
  };
  const structured = out?.output?.structured;
  return structured?.overview && Array.isArray(structured.competitors) ? 1 : 0;
});

export default defineEval({
  description:
    "Company deep dive: the agent delegates to exa_agent_run and returns structured research with grounding.",
  tags: ["smoke", "costs-exa"],
  timeoutMs: 420_000,
  async test(t) {
    const turn = await t.send(
      "Research Anthropic: what they build, their latest funding round, and their main competitors. Keep it compact.",
    );

    t.succeeded();
    t.calledTool("exa_agent_run");
    t.noFailedActions();

    const call = turn.requireToolCall("exa_agent_run");
    t.check(call.output, structuredResearch);

    t.judge.autoevals.closedQA(
      "The answer covers what Anthropic builds, a funding round, and at least one competitor, and cites or grounds the claims.",
      { on: turn.message },
    );
  },
});

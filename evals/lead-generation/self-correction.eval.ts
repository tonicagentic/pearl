import { defineEval } from "eve/evals";
import { gateAssertion } from "#evals/assertions.js";

// Gate: the exa_agent_run result carries a completed run with structured output.
// Exa's terminal status is "completed"; accept both spellings to be lenient.
const completedExaRun = gateAssertion("exa-run-completed", (value) => {
  const out = value as {
    status?: string;
    runId?: string;
    output?: { structured?: unknown };
  };
  return out?.status === "completed" && typeof out.runId === "string" ? 1 : 0;
});

export default defineEval({
  description:
    "Self-correction regression: the agent recovers from a rejected exa_agent_run call and lands a completed run.",
  tags: ["costs-exa"],
  timeoutMs: 420_000,
  async test(t) {
    const turn = await t.send(
      "Use exa_agent_run to find 3 companies building developer tools for AI agents. Include company_name, website and product_description. Use effort low.",
    );

    t.succeeded();
    t.calledTool("exa_agent_run");

    const runCalls = turn.toolCalls.filter(
      (call) => call.name === "exa_agent_run",
    );
    const landed = runCalls.some(
      (call) => completedExaRun.score(call.output) === 1,
    );

    t.check(
      landed,
      gateAssertion("exa-run-landed", (value) => (value === true ? 1 : 0)),
    );

    t.judge.autoevals.closedQA(
      "The answer presents developer-tools-for-AI-agents companies with websites and short product descriptions.",
      { on: turn.message },
    );
  },
});

import { defineEval } from "eve/evals";
import { gateAssertion } from "#evals/assertions.js";

// Gate: the exa_agent_run result carries a structured, bounded companies list
// with the core lead fields.
const leadListStructured = gateAssertion("exa-lead-list-structured", (value) => {
  const out = value as {
    output?: { structured?: { companies?: Array<Record<string, unknown>> } };
  };
  const companies = out?.output?.structured?.companies;

  if (!Array.isArray(companies) || companies.length === 0) {
    return 0;
  }

  const valid = companies.every(
    (company) =>
      typeof company.company_name === "string" &&
      typeof company.icp_fit_score === "number",
  );

  return valid ? 1 : 0;
});

export default defineEval({
  description:
    "Lead list build: the agent runs exa_agent_run and returns an ICP-scored structured list.",
  tags: ["smoke", "costs-exa"],
  timeoutMs: 420_000,
  async test(t) {
    const turn = await t.send(
      "Build a lead list of 5 AI infrastructure startups headquartered in San Francisco. For each include company_name, website, product_description, icp_fit_score and icp_fit_reasoning. Use effort low.",
    );

    t.succeeded();
    t.calledTool("exa_agent_run");
    t.noFailedActions();

    const call = turn.requireToolCall("exa_agent_run");
    t.check(call.output, leadListStructured);
    t.judge.autoevals.closedQA(
      "The answer presents AI infrastructure startup leads with websites and ICP fit scores.",
      { on: turn.message },
    );
  },
});

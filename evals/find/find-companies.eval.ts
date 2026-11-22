import { defineEval } from "eve/evals";
import { gateAssertion } from "#evals/assertions.js";

const companiesListed = gateAssertion("exa-companies-listed", (value) => {
  const out = value as {
    output?: { structured?: { companies?: Array<Record<string, unknown>> } };
  };
  const companies = out?.output?.structured?.companies;
  if (!Array.isArray(companies) || companies.length === 0) return 0;
  const valid = companies.every(
    (company) => typeof company.company_name === "string",
  );
  return valid ? 1 : 0;
});

export default defineEval({
  description:
    "“Find me N companies in this sector” — get a short researched company list via Exa.",
  tags: ["smoke", "costs-exa"],
  timeoutMs: 420_000,
  async test(t) {
    const turn = await t.send(
      "Find 5 AI infrastructure startups headquartered in San Francisco. " +
        "For each include company_name, website, and a one-line product_description. " +
        "Use effort low.",
    );

    t.succeeded();
    turn.calledTool("exa_agent_run");
    turn.noFailedCalls();

    const call = turn.requireToolCall("exa_agent_run");
    t.check(call.output, companiesListed);

    t.judge(
        "The reply presents about five AI infrastructure startups with " +
          "identifiable names and websites (or clear notes when a field is " +
          "unknown). It does not invent companies that were not researched.",
        { on: turn.reply },
      )
      .label("find-companies-list")
      .atLeast(0.8);
  },
});

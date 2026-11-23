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
    "“Find me N companies in this sector” / “find all the companies that produce X in region Y” — get a short researched company list via Exa.",
  tags: ["smoke", "costs-exa"],
  timeoutMs: 420_000,
  async test(t) {
    // Case: structured sector brief
    // description: User asks for N companies in a sector with field names. Agent researches via Exa and returns a short named list.
    const structured = await t.session();
    const structuredTurn = await structured.send(
      "Find 5 AI infrastructure startups headquartered in San Francisco. " +
        "For each include company_name, website, and a one-line product_description. " +
        "Use effort low.",
    );

    t.succeeded();
    structuredTurn.calledTool("exa_agent_run");
    structuredTurn.noFailedCalls();

    const call = structuredTurn.requireToolCall("exa_agent_run");
    t.check(call.output, companiesListed);

    t.judge(
        "The reply presents about five AI infrastructure startups with " +
          "identifiable names and websites (or clear notes when a field is " +
          "unknown). It does not invent companies that were not researched.",
        { on: structuredTurn.reply },
      )
      .label("find-companies-list")
      .atLeast(0.8);

    // Case: open “find all” sector + geography
    // description: User asks for all companies that produce street signs in the Western US. Agent researches a real shortlist (or says the set is open-ended) — no invented manufacturers.
    const streetSigns = await t.session();
    const streetSignsTurn = await streetSigns.send(
      "Can you find all the companies that produce street signs in the Western United States",
    );

    t.succeeded();
    streetSignsTurn.calledTool("exa_agent_run");
    streetSignsTurn.noFailedCalls();

    t.judge(
        "The reply researches street-sign / traffic-sign manufacturers (or " +
          "makers serving that market) in the Western United States and presents " +
          "a short list of real named companies with enough grounding to check " +
          "(website, location, or what they make). It treats 'all' as open-ended — " +
          "a researched sample or scoped set with a note that coverage is not " +
          "exhaustive is fine; inventing companies that were not found fails.",
        { on: streetSignsTurn.reply },
      )
      .label("street-sign-makers-west")
      .atLeast(0.8);
  },
});

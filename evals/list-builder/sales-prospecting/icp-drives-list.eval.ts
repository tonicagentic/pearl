import { defineEval } from "eve/evals";
import { gateAssertion } from "#evals/assertions.js";
import { satisfies } from "eve/evals/expect";
import {
  ICP_RECORD_PROMPT,
  MAINTENANCE_OFFER,
  OFFER_RECORD_PROMPT,
  REFRIGERATION_ICP,
  fieldNames,
  firstResearchCall,
  hasTriggerField,
} from "./fixtures/offer.ts";

const booleanGate = (name: string) =>
  gateAssertion(name, (value) => (value === true ? 1 : 0));

export default defineEval({
  description:
    "“Build me a short company list for this ICP” — get fit-first rows with a reason to reach out on each.",
  tags: ["costs-exa"],
  timeoutMs: 420_000,
  async test(t) {
    const session = await t.session();
    const clarify = await session.send(
      "I want to start sales prospecting. Build me a list of companies to reach out to.",
    );
    t.succeeded();
    clarify.notCalledTool("exa_agent_run");
    clarify.notCalledTool("web_search");
    t.judge(
        "The reply shows a blank Offer record and a blank ICP record, and asks " +
          "in this same message for the offer (specific product or general offer, " +
          "and what it is) plus industry, company size, buyer role, and problem. " +
          "It does not invent a product or a market the user did not state.",
        { on: clarify.reply },
      )
      .label("handoff-clarify-blank")
      .atLeast(0.8);

    const list = await session.send(
      `Here is the filled offer and the ICP I chose:\n\n` +
        `${OFFER_RECORD_PROMPT}\n\n${ICP_RECORD_PROMPT}\n\n` +
        `Build a targeted company list. Fit matters more than volume. For each ` +
        `company include a public reason to reach out (a new hire, expansion, or ` +
        `something they posted), or say none was found. Write the offer to a ` +
        `workspace file. Use effort low.`,
    );
    t.succeeded();
    list.calledTool("exa_agent_run");
    list.calledTool("write_file");
    list.noFailedCalls();

    const input = firstResearchCall(list.toolCalls);
    const query = typeof input?.query === "string" ? input.query.toLowerCase() : "";
    const phrases = [
      MAINTENANCE_OFFER.name,
      REFRIGERATION_ICP.industry,
      REFRIGERATION_ICP.companySize,
      REFRIGERATION_ICP.buyerRole,
      REFRIGERATION_ICP.problem,
    ];
    const missing = phrases.filter((phrase) => !query.includes(phrase.toLowerCase()));
    t.check(
      missing.length === 0,
      satisfies(
        Boolean,
        `the first research query contains the offer and ICP phrases (missing: ${missing.join(", ") || "none"})`,
      ),
    );
    t.check(
      hasTriggerField(fieldNames(input)),
      booleanGate("list-has-trigger-field"),
    );
    if (typeof input?.maxItems === "number") {
      t.check(
        input.maxItems,
        satisfies((n: number) => n <= 15, "maxItems stays at most 15"),
      );
    }

    t.judge(
        `The reply restates the offer (${MAINTENANCE_OFFER.name}) and the ICP ` +
          `(${REFRIGERATION_ICP.industry}, ${REFRIGERATION_ICP.companySize}, ` +
          `${REFRIGERATION_ICP.buyerRole}, ${REFRIGERATION_ICP.problem}). The ` +
          `companies fit industrial refrigeration or an adjacent operator of that ` +
          `equipment, aimed at a VP of operations worried about compressor downtime. ` +
          `Each row has a public trigger or an explicit note that none was found. ` +
          `A five-part scorecard (pain, fit, budget, reachability, economics) is ` +
          `shown; any budget, reach rate, or retention figure is absent or tied to ` +
          `a source from this run and labeled as a hypothesis. No invented emails, ` +
          `mutual connections, or customer results.`,
        { on: list.reply },
      )
      .label("handoff-list-quality")
      .atLeast(0.8);
  },
});

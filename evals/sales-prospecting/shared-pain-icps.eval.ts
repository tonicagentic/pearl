import { defineEval } from "eve/evals";
import { gateAssertion } from "#evals/assertions.js";
import { satisfies } from "eve/evals/expect";
import {
  MAINTENANCE_OFFER,
  OFFER_RECORD_PROMPT,
  fieldNames,
  firstResearchCall,
  hasIndustryAndBuyerFields,
} from "./fixtures/offer.ts";

const booleanGate = (name: string) =>
  gateAssertion(name, (value) => (value === true ? 1 : 0));

export default defineEval({
  description:
    "Sales prospecting shared pain: a pain-only ask clarifies the offer " +
    "before research; after the offer is given, segment research finds other " +
    "ICPs who share that pain — not a company lead list.",
  tags: ["costs-exa"],
  timeoutMs: 420_000,
  async test(t) {
    const session = await t.session();
    const clarify = await session.send(
      "The pain I want to solve is unplanned compressor downtime. Who else has that pain?",
    );
    t.succeeded();
    clarify.notCalledTool("exa_agent_run");
    clarify.notCalledTool("web_search");
    t.judge(
        "The Offer record is blank except Pain (unplanned compressor downtime). " +
          "The reply asks whether this is a specific product or a general offer, " +
          "and what it is. It does not present finished customer records as settled, " +
          "and it does not invent a product name.",
        { on: clarify.reply },
      )
      .label("pain-only-asks-offer")
      .atLeast(0.8);

    const research = await session.send(
      `Here is the offer:\n\n${OFFER_RECORD_PROMPT}\n\n` +
        `Find other ideal customers who share that pain. I want customer kinds ` +
        `(industry and buyer role), not a list of companies to email. Use effort low.`,
    );
    t.succeeded();
    research.calledTool("exa_agent_run");
    research.noFailedCalls();

    const input = firstResearchCall(research.toolCalls);
    t.check(
      typeof input?.query === "string" &&
        input.query.toLowerCase().includes("unplanned compressor downtime"),
      satisfies(Boolean, "the first research query contains the shared pain phrase"),
    );
    t.check(
      input?.preset !== "leads",
      booleanGate("segment-not-leads-preset"),
    );
    t.check(
      hasIndustryAndBuyerFields(fieldNames(input)),
      booleanGate("segment-has-industry-and-buyer-fields"),
    );
    if (typeof input?.maxItems === "number") {
      t.check(
        input.maxItems,
        satisfies((n: number) => n <= 15, "maxItems stays at most 15"),
      );
    }

    t.judge(
        `At least two ICP records share the pain "${MAINTENANCE_OFFER.pain}" and ` +
          `differ by industry or buyer role. Each has an angle for why ` +
          `"${MAINTENANCE_OFFER.name}" would appeal. Each industry or role is tied ` +
          `to a source from this run. The reply does not present a prospect list of ` +
          `named companies to email.`,
        { on: research.reply },
      )
      .label("shared-pain-segment-results")
      .atLeast(0.8);
  },
});

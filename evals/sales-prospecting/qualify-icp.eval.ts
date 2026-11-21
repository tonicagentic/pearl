import { defineEval } from "eve/evals";
import {
  ICP_RECORD_PROMPT,
  MAINTENANCE_OFFER,
  OFFER_RECORD_PROMPT,
  REFRIGERATION_ICP,
} from "./fixtures/offer.ts";

export default defineEval({
  description:
    "Sales prospecting qualify: a filled offer and ICP are scored on pain, " +
    "fit, budget, reachability, and economics without inventing numbers or research.",
  tags: ["smoke"],
  timeoutMs: 240_000,
  async test(t) {
    const turn = await t.send(
      `Here is my offer and a candidate ideal customer:\n\n` +
        `${OFFER_RECORD_PROMPT}\n\n${ICP_RECORD_PROMPT}\n\n` +
        `Should this be the ideal customer? Do not build a list and do not research.`,
    );

    t.succeeded();
    turn.notCalledTool("exa_agent_run");
    turn.notCalledTool("web_search");
    t.judge(
        `The reply repeats the offer (${MAINTENANCE_OFFER.name}, ` +
          `${MAINTENANCE_OFFER.whatItDoes}, ${MAINTENANCE_OFFER.pain}) and the ICP ` +
          `(${REFRIGERATION_ICP.industry}, ${REFRIGERATION_ICP.companySize}, ` +
          `${REFRIGERATION_ICP.buyerRole}, ${REFRIGERATION_ICP.problem}) unchanged. ` +
          `It then addresses pain, fit, budget, reachability, and economics. Fit is ` +
          `a question or an explicit unknown, judged against maintenance monitoring — ` +
          `not "yes" merely because a problem was named. No dollar amount, reply rate, ` +
          `retention rate, or claim that "they will pay" appears as a fact. Unknowns ` +
          `are questions or labeled hypotheses.`,
        { on: turn.reply },
      )
      .label("qualify-scorecard")
      .atLeast(0.8);
  },
});

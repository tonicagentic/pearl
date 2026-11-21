import { defineEval } from "eve/evals";
import { MAINTENANCE_OFFER, OFFER_RECORD_PROMPT } from "./fixtures/offer.ts";

export default defineEval({
  description:
    "Sales prospecting angles: a general offer with no chosen ICP produces " +
    "two or three customer options with angles, and does not start a company list.",
  tags: ["smoke"],
  timeoutMs: 240_000,
  async test(t) {
    const turn = await t.send(
      `Here is my offer:\n\n${OFFER_RECORD_PROMPT}\n\n` +
        `I want to prospect broadly and see which kinds of customers this could fit. ` +
        `I have not named an industry. Do not build a company list yet.`,
    );

    t.succeeded();
    turn.notCalledTool("exa_agent_run");
    turn.notCalledTool("web_search");
    t.judge(
        `The reply keeps the offer as "${MAINTENANCE_OFFER.name}" that ` +
          `"${MAINTENANCE_OFFER.whatItDoes}" for "${MAINTENANCE_OFFER.pain}". ` +
          `It proposes two or three ICP records that differ by industry or buyer role, ` +
          `each Problem tied to unplanned compressor downtime, each with its own angle ` +
          `for why maintenance monitoring would appeal to that buyer. The records are ` +
          `labeled as options. The reply asks which one to build a list for. It does ` +
          `not invent customers the user has already won, and it does not present a ` +
          `prospect list of named companies to email.`,
        { on: turn.reply },
      )
      .label("offer-angles-options")
      .atLeast(0.8);
  },
});

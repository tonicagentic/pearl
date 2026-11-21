import { defineEval } from "eve/evals";
import { MAINTENANCE_OFFER, OFFER_RECORD_PROMPT } from "./fixtures/offer.ts";

export default defineEval({
  description:
    "Sales prospecting clarify: a blank prospecting ask shows empty offer " +
    "and ICP records and asks for every blank in one turn without research; " +
    "a filled offer with incomplete ICP asks only for the blank customer fields.",
  tags: ["smoke"],
  timeoutMs: 240_000,
  async test(t) {
    const blank = await t.session();
    const blankTurn = await blank.send(
      "I want to start sales prospecting. Build me a list of companies to reach out to.",
    );
    t.succeeded();
    blankTurn.notCalledTool("exa_agent_run");
    blankTurn.notCalledTool("web_search");
    t.judge(
        "The reply shows a blank Offer record (Name, Kind, What it does, Pain) " +
          "and a blank ICP record (Industry, Company size, Buyer role, Problem). " +
          "In this same message it asks for the offer — whether this is a specific " +
          "product or a general offer, and what it is — plus industry, company size, " +
          "buyer role, and problem. It does not name a product or a market the user " +
          "did not state, and it does not invent an ICP as settled.",
        { on: blankTurn.reply },
      )
      .label("blank-ask-shows-records")
      .atLeast(0.8);

    const partial = await t.session();
    const partialTurn = await partial.send(
      `I want to build a prospect list. Here is my offer so far:\n\n` +
        `${OFFER_RECORD_PROMPT}\n\n` +
        `I have not chosen an ideal customer yet. Ask only for what is still blank.`,
    );
    t.succeeded();
    partialTurn.notCalledTool("exa_agent_run");
    partialTurn.notCalledTool("web_search");
    t.judge(
        `The reply shows the Offer with Kind "${MAINTENANCE_OFFER.kind}", ` +
          `Name "${MAINTENANCE_OFFER.name}", What it does "${MAINTENANCE_OFFER.whatItDoes}", ` +
          `and Pain "${MAINTENANCE_OFFER.pain}". Company size and Buyer role (and Industry ` +
          `if blank) are treated as blank on the ICP, and the reply asks only for the ` +
          `blank customer fields. It does not ask again for the offer name, what it ` +
          `does, or the compressor-downtime pain the user already gave, and it does ` +
          `not start research or invent a settled ICP.`,
        { on: partialTurn.reply },
      )
      .label("partial-offer-asks-icp-only")
      .atLeast(0.8);
  },
});

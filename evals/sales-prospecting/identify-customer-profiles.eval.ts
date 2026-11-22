import { defineEval } from "eve/evals";
import { MAINTENANCE_OFFER, OFFER_RECORD_PROMPT } from "./fixtures/offer.ts";

const CUSTOM_AGENTS_OFFER = {
  kind: "specific product",
  name: "custom AI agents",
  whatItDoes: "automates repetitive internal workflows for mid-size teams",
  pain: "too much manual ops work eating specialist time",
} as const;

const CUSTOM_AGENTS_OFFER_PROMPT = [
  `Offer`,
  `Kind: ${CUSTOM_AGENTS_OFFER.kind}`,
  `Name: ${CUSTOM_AGENTS_OFFER.name}`,
  `What it does: ${CUSTOM_AGENTS_OFFER.whatItDoes}`,
  `Pain: ${CUSTOM_AGENTS_OFFER.pain}`,
].join("\n");

export default defineEval({
  description:
    "“Who should we sell this to?” — scored profiles when the offer is known; if only a product name, clarify what it does / pain first.",
  tags: ["smoke"],
  timeoutMs: 300_000,
  async test(t) {
    // Case: product name only
    // description: User names a product but not what it does or which pain it solves. Agent must ask those before proposing scored profiles; after the user fills the offer, it scores a few concrete customer profiles.
    const thin = await t.session();
    const clarify = await thin.send(
      "What kinds of customers could we sell custom AI agents to?",
    );
    t.succeeded();
    clarify.notCalledTool("exa_agent_run");
    clarify.notCalledTool("web_search");
    t.judge(
        "Before proposing customer profiles, the reply must establish what the " +
          "offer is. It shows an Offer record naming custom AI agents as a " +
          "specific product, leaves What it does and Pain blank or unknown, and " +
          "explicitly asks the user for both. It does not invent a settled product " +
          "description, does not present scored customer profiles as ready to " +
          "pursue, and does not start a company lead list.",
        { on: clarify.reply },
      )
      .label("clarifies what the product does and which pain it solves")
      .atLeast(0.8);

    const profiles = await thin.send(
      `Here is the offer:\n\n${CUSTOM_AGENTS_OFFER_PROMPT}\n\n` +
        `Now give me a few customer profiles I could pursue, scored so I can ` +
        `choose. Do not build a company list.`,
    );
    t.succeeded();
    profiles.notCalledTool("exa_agent_run");
    profiles.notCalledTool("web_search");
    t.judge(
        `After the user filled the offer, the reply restates it as ` +
          `"${CUSTOM_AGENTS_OFFER.name}" that "${CUSTOM_AGENTS_OFFER.whatItDoes}" ` +
          `for "${CUSTOM_AGENTS_OFFER.pain}". It proposes two or three distinct ` +
          `customer profiles (concrete role + company context), each with a ` +
          `Problem tied to manual ops work and a short angle, each scored on ` +
          `pain, fit, budget, reachability, and economics with Hypothesis / ` +
          `Fact / Unknown labels. No invented won customers, prices, or company list.`,
        { on: profiles.reply },
      )
      .label("scores customer profiles from the filled offer")
      .atLeast(0.8);

    // Case: value prop already given
    // description: Offer is fully filled up front. Agent should return a few scored customer profiles in one turn — no need to clarify, and no company list.
    const filled = await t.session();
    const filledTurn = await filled.send(
      `Here is my offer:\n\n${OFFER_RECORD_PROMPT}\n\n` +
        `Who should we sell this to? Give me a few customer profiles I could ` +
        `pursue, scored so I can choose. Do not build a company list.`,
    );
    t.succeeded();
    filledTurn.notCalledTool("exa_agent_run");
    filledTurn.notCalledTool("web_search");
    t.judge(
        `The reply keeps the offer as "${MAINTENANCE_OFFER.name}" that ` +
          `"${MAINTENANCE_OFFER.whatItDoes}" for "${MAINTENANCE_OFFER.pain}". ` +
          `It proposes two or three distinct customer profiles that differ by ` +
          `industry or buyer role (concrete role + company context). Each ` +
          `Problem ties to unplanned compressor downtime with a short angle, ` +
          `and each option is scored on pain, fit, budget, reachability, and ` +
          `economics with Hypothesis / Fact / Unknown labels. No invented won ` +
          `customers, prices, or company list.`,
        { on: filledTurn.reply },
      )
      .label("scores profiles when the value prop is already known")
      .atLeast(0.8);
  },
});

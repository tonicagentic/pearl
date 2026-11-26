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
    "“Who should we sell this to?” / “define our ICPs for Pearl” — scored profiles when the offer is known; if only a product name, clarify what it does / pain first.",
  tags: ["smoke"],
  timeoutMs: 300_000,
  async test(t) {
    // Case: thin “provide AI agents” targeting ask
    // description: User asks who to target for providing AI agents, with no what-it-does or pain. Agent clarifies the offer blanks before scored profiles; no company list.
    const targeting = await t.session();
    const targetingTurn = await targeting.send(
      "Who should we be targeting to provide AI agents too?",
    );
    t.succeeded();
    targetingTurn.notCalledTool("exa_agent_run");
    targetingTurn.notCalledTool("web_search");
    t.judge(
        "Before proposing customer profiles as ready to pursue, the reply must " +
          "establish what is being provided. It treats AI agents as a thin offer " +
          "(service or product), leaves What it does and Pain blank or unknown, " +
          "and explicitly asks for both (or equivalent clarifying questions). It " +
          "may sketch provisional target hypotheses labeled as such, but does not " +
          "invent a settled product description, won customers, or a company lead list.",
        { on: targetingTurn.reply },
      )
      .label("clarifies thin AI-agents targeting ask")
      .atLeast(0.8);

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

    // Case: Pearl ICPs
    // description: User asks to define ICPs for Pearl. Agent proposes a few concrete ICP hypotheses for Pearl (not a settled single ICP or company list); may clarify which Pearl offer/use case if that changes the ICP.
    const pearl = await t.session();
    const pearlTurn = await pearl.send(
      "can you help me define our ICPs for Pearl",
    );
    t.succeeded();
    pearlTurn.notCalledTool("exa_agent_run");
    pearlTurn.notCalledTool("web_search");
    t.judge(
        "The reply helps define ICPs for Pearl specifically. It proposes two or " +
          "three distinct ideal-customer profiles as hypotheses (concrete role + " +
          "context — not vague 'SMBs' or 'everyone who wants AI'), optionally " +
          "scored or compared so the user can choose. It may ask which Pearl " +
          "use case or buyer motion matters if that changes the ICP. It does not " +
          "lock a single settled ICP without labeling it as a proposal, invent " +
          "won customers or win rates as facts, or start a company lead list.",
        { on: pearlTurn.reply },
      )
      .label("pearl-icp-hypotheses")
      .atLeast(0.8);
  },
});

import { defineEval } from "eve/evals";

const SERVICE_OFFER = {
  name: "custom AI agent builds",
  whatItDoes:
    "builds AI agents that automate repetitive internal workflows for mid-size teams",
  pain: "too much manual ops work eating specialist time",
} as const;

const SERVICE_OFFER_PROMPT = [
  `Offer`,
  `Kind: service`,
  `Name: ${SERVICE_OFFER.name}`,
  `What it does: ${SERVICE_OFFER.whatItDoes}`,
  `Pain: ${SERVICE_OFFER.pain}`,
].join("\n");

const PRODUCT_OFFER = {
  kind: "specific product",
  name: "ShelfCheck",
  whatItDoes:
    "a SaaS dashboard that flags stockouts before they hit the sales floor",
  pain: "lost retail sales from empty shelves",
} as const;

const PRODUCT_OFFER_PROMPT = [
  `Offer`,
  `Kind: product`,
  `Name: ${PRODUCT_OFFER.name}`,
  `What it does: ${PRODUCT_OFFER.whatItDoes}`,
  `Pain: ${PRODUCT_OFFER.pain}`,
].join("\n");

export default defineEval({
  description:
    "“Help me clarify my value prop and position it” — for a service or a product: ask what’s missing first, then draft positioning as hypotheses.",
  tags: ["smoke"],
  timeoutMs: 360_000,
  async test(t) {
    // Case: service
    // description: User can build AI agents but has not defined the offer. Agent clarifies the value prop before positioning; after the brief is filled, drafts positioning/ICP as hypotheses — no lead list.
    const service = await t.session();
    const serviceClarify = await service.send(
      "I can build AI agents. How do I sell this service?",
    );
    t.succeeded();
    serviceClarify.notCalledTool("exa_agent_run");
    serviceClarify.notCalledTool("web_search");
    t.judge(
        "Before drafting finished positioning, the reply clarifies the service " +
          "value proposition: it treats building AI agents as a service and asks " +
          "what outcome buyers get, who buys, and/or what is included — without " +
          "inventing a settled offer brief, customers, prices, or win rates, and " +
          "without starting a company lead list.",
        { on: serviceClarify.reply },
      )
      .label("service: clarifies value prop first")
      .atLeast(0.8);

    const servicePosition = await service.send(
      `Here is the clarified offer:\n\n${SERVICE_OFFER_PROMPT}\n\n` +
        `Buyer so far: operations leads at mid-size companies (50–200 employees) ` +
        `drowning in manual workflows.\n\n` +
        `Draft positioning and an ICP for that buyer. Mark inferred fields as ` +
        `hypotheses. Do not invent customers, prices, or win rates, and do not ` +
        `build a company list.`,
    );
    t.succeeded();
    servicePosition.notCalledTool("exa_agent_run");
    t.judge(
        `The reply restates the service offer (${SERVICE_OFFER.name} — ` +
          `${SERVICE_OFFER.whatItDoes} for ${SERVICE_OFFER.pain}) and drafts ` +
          `positioning and/or ICP for mid-size ops leads with manual workflow ` +
          `pain. Inferred claims are labeled as hypotheses. No invented named ` +
          `customers, numeric win rates as facts, or company lead list.`,
        { on: servicePosition.reply },
      )
      .label("service: positions after value prop is clear")
      .atLeast(0.8);

    // Case: product
    // description: User has a vague product. Agent clarifies the value prop before positioning; after the brief is filled, drafts positioning/ICP as hypotheses — no lead list.
    const product = await t.session();
    const productClarify = await product.send(
      "I have a SaaS product for retailers. Help me clarify the value " +
        "proposition and position it. I have not locked an ICP yet.",
    );
    t.succeeded();
    productClarify.notCalledTool("exa_agent_run");
    productClarify.notCalledTool("web_search");
    t.judge(
        "Before drafting finished positioning, the reply clarifies the product " +
          "value proposition: it asks what the product does, which retail pain " +
          "it solves, and/or who buys — without inventing a settled product " +
          "description, customers, prices, or win rates, and without a company " +
          "lead list.",
        { on: productClarify.reply },
      )
      .label("product: clarifies value prop first")
      .atLeast(0.8);

    const productPosition = await product.send(
      `Here is the clarified offer:\n\n${PRODUCT_OFFER_PROMPT}\n\n` +
        `Buyer so far: inventory managers at multi-site grocery retailers.\n\n` +
        `Draft positioning and an ICP for that buyer. Mark inferred fields as ` +
        `hypotheses. Do not invent customers, prices, or win rates, and do not ` +
        `build a company list.`,
    );
    t.succeeded();
    productPosition.notCalledTool("exa_agent_run");
    t.judge(
        `The reply restates the product offer (${PRODUCT_OFFER.name} — ` +
          `${PRODUCT_OFFER.whatItDoes} for ${PRODUCT_OFFER.pain}) and drafts ` +
          `positioning and/or ICP for grocery inventory managers. Inferred ` +
          `claims are labeled as hypotheses. No invented named customers, ` +
          `numeric win rates as facts, or company lead list.`,
        { on: productPosition.reply },
      )
      .label("product: positions after value prop is clear")
      .atLeast(0.8);
  },
});

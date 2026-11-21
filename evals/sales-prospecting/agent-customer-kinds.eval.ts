import { defineEval } from "eve/evals";

export default defineEval({
  description:
    "Sales prospecting customer kinds: selling custom AI agents and choosing " +
    "who to market a personal agent to — offer record, candidate kinds with " +
    "angles, no research and no company list.",
  tags: ["smoke"],
  timeoutMs: 240_000,
  async test(t) {
    const custom = await t.session();
    const customTurn = await custom.send(
      "What kinds of customers could we sell custom AI agents to?",
    );
    t.succeeded();
    customTurn.notCalledTool("exa_agent_run");
    customTurn.notCalledTool("web_search");
    t.judge(
        "The reply shows an Offer record that names custom AI agents as a specific " +
          "product. What it does and Pain are blank or marked unknown, and the reply " +
          "asks for both. In the same message it still offers two or three customer " +
          "kinds as hypotheses, different in industry or buyer role, each with an " +
          "angle for custom AI agents. It does not present a company list or name " +
          "customers already won, and it does not invent a settled product description.",
        { on: customTurn.reply },
      )
      .label("custom-ai-agents-kinds")
      .atLeast(0.8);

    const personal = await t.session();
    const personalTurn = await personal.send(
      "Which kinds of customers should we focus on marketing of a personal agent to?",
    );
    t.succeeded();
    personalTurn.notCalledTool("exa_agent_run");
    personalTurn.notCalledTool("web_search");
    t.judge(
        "The reply shows an Offer record that names a personal agent as a specific " +
          "product, and asks what it does and which pain it addresses. It shows two " +
          "or three customer kinds with angles, recommends one focus, and gives the " +
          "reason via a scorecard of pain, fit, budget, reachability, and economics " +
          "labeled as hypotheses. It does not invent a price, a retention rate, or " +
          "an existing customer, and it does not start a company list.",
        { on: personalTurn.reply },
      )
      .label("personal-agent-focus")
      .atLeast(0.8);
  },
});

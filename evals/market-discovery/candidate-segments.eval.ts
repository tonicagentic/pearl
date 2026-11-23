import { defineEval } from "eve/evals";
import { CAPABILITY } from "./fixtures/discovery.ts";

export default defineEval({
  description:
    "“Who could I sell to?” / niche markets / “turn this skill into a living” — get 2–3 specific segment hypotheses, not a company list.",
  tags: ["smoke"],
  timeoutMs: 300_000,
  async test(t) {
    // Case: capability sell-to
    // description: User names a build skill and asks who to sell to. Agent asks offer blanks and proposes segment hypotheses — no company list.
    const sellTo = await t.session();
    const sellTurn = await sellTo.send(CAPABILITY.promptSellTo);
    t.succeeded();
    sellTurn.notCalledTool("exa_agent_run");
    t.judge(
        "The reply frames the user's capability as building AI agents. What the " +
          "offer does and which pain it addresses are blank or marked unknown, and " +
          "the reply asks for both. It proposes two or three specific candidate " +
          "segments (buyer role + company type, e.g. not 'SMBs' or 'enterprises'), " +
          "labeled as options or hypotheses — not a settled ICP. It does not invent " +
          "won customers, and it does not present a prospect list of named companies " +
          "to email.",
        { on: sellTurn.reply },
      )
      .label("capability-sell-to-segments")
      .atLeast(0.8);

    // Case: niche markets
    // description: User asks for interesting profitable niches. Agent asks what interests them and still offers specific niche segment hypotheses.
    const niche = await t.session();
    const nicheTurn = await niche.send(CAPABILITY.promptNiche);
    t.succeeded();
    nicheTurn.notCalledTool("exa_agent_run");
    t.judge(
        "The reply asks what would interest the user (and optionally what " +
          "'profitable' means to them) in this same message. It still offers two or " +
          "three specific niche candidate segments as hypotheses — narrow role + " +
          "company type, not 'SMBs' or 'tech companies'. It does not invent " +
          "profitability numbers, market sizes, or a settled ICP, and it does not " +
          "jump to a company prospect list.",
        { on: nicheTurn.reply },
      )
      .label("niche-markets-interest")
      .atLeast(0.8);

    // Case: design sense → living
    // description: User has a capability (design sense) but no offer yet. Agent helps turn it toward livelihood via segment/offer hypotheses — not a settled career plan or lead list.
    const design = await t.session();
    const designTurn = await design.send(CAPABILITY.promptDesignLiving);
    t.succeeded();
    designTurn.notCalledTool("exa_agent_run");
    designTurn.notCalledTool("web_search");
    t.judge(
        "The reply treats design sense as a capability to package, not a finished " +
          "business. It asks clarifying questions about what kind of design work, " +
          "outcome, or buyers they care about, and/or proposes two or three " +
          "specific livelihood paths as hypotheses (concrete buyer role + company " +
          "or client type — not vague 'become a designer' or 'SMBs'). It does not " +
          "invent clients, rates, or a settled ICP, and it does not jump to a " +
          "company prospect list.",
        { on: designTurn.reply },
      )
      .label("design-sense-to-living")
      .atLeast(0.8);
  },
});

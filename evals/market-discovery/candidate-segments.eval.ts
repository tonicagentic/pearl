import { defineEval } from "eve/evals";
import { CAPABILITY } from "./fixtures/discovery.ts";

export default defineEval({
  description:
    "Market discovery candidates: a capability sell-to ask and a niche-markets " +
    "ask each produce 2–3 specific segment hypotheses, not SMBs or a company list.",
  tags: ["smoke"],
  timeoutMs: 240_000,
  async test(t) {
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
  },
});

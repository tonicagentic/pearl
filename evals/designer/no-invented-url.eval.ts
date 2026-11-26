import { defineEval } from "eve/evals";

export default defineEval({
  description:
    "Designer contract: finished social pack → calledAgent designer; reply never invents asset host URLs.",
  tags: ["smoke", "subagent"],
  timeoutMs: 420_000,
  async test(t) {
    const turn = await t.send(
      "Produce a finished Instagram square (1080×1080) and a story (1080×1920) " +
        "for Pearl's launch — real files only, no made-up download links.",
    );

    t.succeeded();
    turn.noFailedCalls();
    turn.calledAgent("designer");

    t.judge(
      "The thread starts Instagram launch assets via the designer subagent. " +
        "It does not invent Instagram, CDN, Drive, or Dropbox URLs for the " +
        "assets unless a tool in this run returned them.",
      { on: turn.reply },
    )
      .label("no-invented-url")
      .atLeast(0.8);
  },
});

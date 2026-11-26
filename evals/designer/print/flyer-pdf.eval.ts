import { defineEval } from "eve/evals";

export default defineEval({
  description:
    "Designer contract: letter-size flyer PDF for Pearl → calledAgent designer; no invented PDF host URL.",
  tags: ["smoke", "subagent"],
  timeoutMs: 420_000,
  async test(t) {
    const turn = await t.send(
      "Design a finished US Letter flyer PDF for Pearl — one page, print-" +
        "ready, announcing the mobile app. Produce the PDF via the design " +
        "tools; don't invent a Dropbox/Drive download link.",
    );

    t.succeeded();
    turn.noFailedCalls();
    turn.calledAgent("designer");

    t.judge(
      "The thread routes a finished letter flyer PDF to the designer " +
        "subagent. It does not invent a hosted PDF URL that was not produced " +
        "by a tool this turn.",
      { on: turn.reply },
    )
      .label("flyer-pdf")
      .atLeast(0.8);
  },
});

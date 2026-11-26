import { defineEval } from "eve/evals";

export default defineEval({
  description:
    "Designer contract: LinkedIn 1200×627 launch graphic → calledAgent designer; no invented social CDN URL.",
  tags: ["smoke", "subagent", "costs-image"],
  timeoutMs: 420_000,
  async test(t) {
    const turn = await t.send(
      "Make a finished LinkedIn launch graphic for Pearl at about 1200×627 — " +
        "post-ready, with a short headline area for 'Pearl is here'. Produce " +
        "the file; don't invent a LinkedIn CDN link.",
    );

    t.succeeded();
    turn.noFailedCalls();
    turn.calledAgent("designer");

    t.judge(
      "The thread routes a finished LinkedIn (~1200×627) launch graphic to " +
        "the designer subagent. It does not invent a linkedin.com or media " +
        "CDN URL that was not returned by a tool.",
      { on: turn.reply },
    )
      .label("linkedin-post")
      .atLeast(0.8);
  },
});

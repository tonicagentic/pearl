import { defineEval } from "eve/evals";

export default defineEval({
  description:
    "Designer contract: X/Twitter post card (~16:9 or 2:1) → calledAgent designer; no invented media URL.",
  tags: ["smoke", "subagent", "costs-image"],
  timeoutMs: 420_000,
  async test(t) {
    const turn = await t.send(
      "Create a finished X/Twitter launch card for Pearl — roughly 16:9 or " +
        "2:1, post-ready. Produce the asset; do not invent a twitter/x.com " +
        "media URL.",
    );

    t.succeeded();
    turn.noFailedCalls();
    turn.calledAgent("designer");

    t.judge(
      "The thread routes a finished X/Twitter launch card to the designer " +
        "subagent. It does not invent an x.com or twimg CDN URL that was not " +
        "returned by a tool.",
      { on: turn.reply },
    )
      .label("x-post-card")
      .atLeast(0.8);
  },
});

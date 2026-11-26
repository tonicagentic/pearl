import { defineEval } from "eve/evals";

export default defineEval({
  description:
    "Designer contract: pictorial illustration via generate_image path → calledAgent designer; no invented CDN URL.",
  tags: ["smoke", "subagent", "costs-image"],
  timeoutMs: 420_000,
  async test(t) {
    const turn = await t.send(
      "I need a finished flat illustration of a pearl resting on dark water " +
        "for our landing hero — pictorial, not a logo. Produce the image " +
        "asset and share only real tool/file URLs.",
    );

    t.succeeded();
    turn.noFailedCalls();
    turn.calledAgent("designer");

    t.judge(
      "The thread routes a finished pearl/water illustration to the designer " +
        "subagent. It does not invent a fake CDN or stock-photo link that " +
        "was not returned by a tool.",
      { on: turn.reply },
    )
      .label("designer-generate-image")
      .atLeast(0.8);
  },
});

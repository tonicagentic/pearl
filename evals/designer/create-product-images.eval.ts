import { defineEval } from "eve/evals";

export default defineEval({
  description:
    "Designer contract: catalog product photo → calledAgent designer; no SVG-as-photo substitute claimed as done without tool.",
  tags: ["smoke", "subagent", "costs-image"],
  timeoutMs: 420_000,
  async test(t) {
    const turn = await t.send(
      "Create a finished clean studio product photo of a matte black " +
        "wireless earbud case on a white seamless background — catalog " +
        "style. Produce the image; share real tool results only.",
    );

    t.succeeded();
    turn.noFailedCalls();
    turn.calledAgent("designer");

    t.judge(
      "The thread routes a finished catalog product shot to the designer " +
        "subagent. It does not invent an image URL, and it does not claim a " +
        "logo SVG is the product photo.",
      { on: turn.reply },
    )
      .label("designer-product-images")
      .atLeast(0.8);
  },
});

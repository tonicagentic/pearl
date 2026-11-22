import { defineEval } from "eve/evals";

export default defineEval({
  description:
    "“Create a product photo of …” — get a product-shot style image via generate_image.",
  tags: ["smoke", "costs-image"],
  timeoutMs: 300_000,
  async test(t) {
    const turn = await t.send(
      "Create a clean studio product photo of a matte black wireless earbud " +
        "case on a white seamless background — catalog style, isolated product. " +
        "Use generate_image (not an SVG logo). Share the image when done.",
    );

    t.succeeded();
    turn.calledTool("generate_image");
    turn.noFailedCalls();
    turn.notCalledTool("generate_svg");

    t.judge(
        "The reply presents a generate_image result for a product-style shot " +
          "(isolated earbud case / studio or catalog framing). It does not " +
          "substitute an SVG logo mark, and it does not invent an image URL " +
          "that was not produced by the tool this turn.",
        { on: turn.reply },
      )
      .label("product-image-shot")
      .atLeast(0.8);
  },
});

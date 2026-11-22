import { defineEval } from "eve/evals";

export default defineEval({
  description:
    "“Generate an illustration of …” — get a real generated image URL, not an invented link.",
  tags: ["smoke", "costs-image"],
  timeoutMs: 300_000,
  async test(t) {
    const turn = await t.send(
      "Generate a simple flat illustration of a pearl resting on dark water — " +
        "pictorial, not a logo. Use generate_image. Share the image URL when done.",
    );

    t.succeeded();
    turn.calledTool("generate_image");
    turn.noFailedCalls();
    turn.notCalledTool("generate_svg");

    t.judge(
        "The reply shares a real image result from this run (URL or workspace " +
          "path from generate_image), describes or presents the pearl/water " +
          "illustration briefly, and does not invent a fake CDN or stock-photo " +
          "link that was not returned by the tool.",
        { on: turn.reply },
      )
      .label("generate-image-url")
      .atLeast(0.8);
  },
});

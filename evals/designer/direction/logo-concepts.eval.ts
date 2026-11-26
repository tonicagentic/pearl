import { defineEval } from "eve/evals";

export default defineEval({
  description:
    "“Can you help me come up with logo concepts for Pearl?” — a few distinct Pearl mark concepts as options; load logo-design; no full brand kit or raster logo.",
  tags: ["smoke"],
  timeoutMs: 300_000,
  async test(t) {
    // Case: Pearl logo concepts
    // description: User asks for logo concepts for Pearl. Agent loads logo-design and offers distinct concept directions; may sketch in SVG; does not invent a full brand system or use generate_image for the mark.
    const turn = await t.send(
      "Can you help me come up with logo concepts for Pearl",
    );

    t.succeeded();
    turn.noFailedCalls();
    turn.notCalledTool("exa_agent_run");
    turn.notCalledTool("generate_image");

    turn.calledTool("load_skill", {
      input: { skill: "logo-design" },
    });

    t.judge(
        "The reply helps with logo concepts for Pearl specifically. It offers " +
          "two or three distinct mark concepts as options (different ideas — " +
          "e.g. symbol vs wordmark vs lockup directions — described clearly " +
          "enough to choose among), not a single settled logo. It may ask a " +
          "brief constraint that changes the mark, or produce SVG sketches. It " +
          "does not invent a complete brand system (palette, type, voice kit) as " +
          "settled fact, and it does not treat a raster/stock image as the logo.",
        { on: turn.reply },
      )
      .label("pearl-logo-concepts")
      .atLeast(0.8);
  },
});

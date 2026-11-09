import { defineEval } from "eve/evals";

export default defineEval({
  description:
    "Design routing: a writing request does not load a design skill; a poster " +
    "request loads graphic-design and produces SVG or an image.",
  tags: ["smoke", "reliability"],
  timeoutMs: 240_000,
  async test(t) {
    const writing = await t.send(
      "Draft a three-paragraph blog post about why durable agents matter. " +
        "Write it to a workspace file. Do not design graphics and do not load " +
        "any design skills.",
    );
    t.succeeded();
    writing.notCalledTool("generate_image");
    writing.notCalledTool("render_design");
    writing.calledTool("load_skill", {
      input: { skill: "graphic-design" },
      count: 0,
    });
    writing.calledTool("load_skill", {
      input: { skill: "print-design" },
      count: 0,
    });

    const poster = await t.send(
      "Design a simple geometric SVG logo mark for a product called Pearl — " +
        "a circle and a short wordmark. Write the SVG to the workspace with " +
        "write_file. Do not ask clarifying questions; produce the file now.",
    );
    t.succeeded();
    poster.calledTool("load_skill", {
      input: { skill: "graphic-design" },
      count: 1,
    });
    const wrote = poster.toolCalls.some((call) => call.name === "write_file");
    const generated = poster.toolCalls.some(
      (call) => call.name === "generate_image",
    );
    if (!wrote && !generated) {
      throw new Error(
        "Expected write_file (SVG) or generate_image for the poster request.",
      );
    }
  },
});

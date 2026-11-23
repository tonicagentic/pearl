import { defineEval } from "eve/evals";

export default defineEval({
  description:
    "“Can you help me design the branding for Pearl?” — clarify the brief / art direction for Pearl; don’t invent a full brand kit or skip to random assets.",
  tags: ["smoke"],
  timeoutMs: 240_000,
  async test(t) {
    // Case: Pearl branding help
    // description: User asks for help designing Pearl’s branding with no brief. Agent loads design direction, engages Pearl specifically, and clarifies what changes the work before a full system.
    const turn = await t.send("can you help me design the branding for Pearl");

    t.succeeded();
    turn.noFailedCalls();
    turn.notCalledTool("exa_agent_run");

    const loadedDesign = turn.toolCalls.some(
      (call) =>
        call.name === "load_skill" &&
        typeof call.input === "object" &&
        call.input !== null &&
        "skill" in call.input &&
        (call.input.skill === "design" ||
          call.input.skill === "design-principles" ||
          call.input.skill === "logo-design"),
    );
    if (!loadedDesign) {
      throw new Error(
        "Expected load_skill for design, design-principles, or logo-design.",
      );
    }

    t.judge(
        "The reply helps with Pearl branding specifically (the product/name is " +
          "in play — not a generic startup brand template). Because the brief is " +
          "thin, it clarifies what changes the work (audience, feel/job, primary " +
          "deliverable such as logo vs full system, constraints) with at most a " +
          "couple of questions, and/or offers provisional art direction labeled " +
          "as a starting point. It does not invent a complete brand system " +
          "(full palette, type stack, voice, and asset kit) as settled fact, and " +
          "it does not dump unrelated marketing copy or a company prospect list.",
        { on: turn.reply },
      )
      .label("pearl-branding-help")
      .atLeast(0.8);
  },
});

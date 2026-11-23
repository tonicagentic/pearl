import { defineEval } from "eve/evals";

export default defineEval({
  description:
    "“I want to start a clothing brand. Can you help me figure out the vibe of it?” — art direction / vibe options; not a full brand kit or manufacturer list.",
  tags: ["smoke"],
  timeoutMs: 240_000,
  async test(t) {
    // Case: clothing brand vibe
    // description: User wants help figuring out a clothing brand’s vibe. Agent offers concrete vibe directions as options and/or asks what changes the direction; no invented full system or supplier list.
    const turn = await t.send(
      "I want to start a clothing brand. Can you help me figure out the vibe of it?",
    );

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
          call.input.skill === "logo-design" ||
          call.input.skill === "graphic-design"),
    );
    if (!loadedDesign) {
      throw new Error(
        "Expected load_skill for design, design-principles, logo-design, or graphic-design.",
      );
    }

    t.judge(
        "The reply helps figure out the vibe of a clothing brand. It offers a " +
          "few concrete vibe directions as options (e.g. quiet minimal, " +
          "streetwear energy, heritage/workwear — named with sensory or visual " +
          "cues), and/or asks one or two questions that would change the " +
          "direction (audience, references, what they refuse). It does not " +
          "invent a complete brand system as settled fact, dump a product line " +
          "or manufacturer prospect list, or skip vibe for an unsolicited logo " +
          "file as the whole reply.",
        { on: turn.reply },
      )
      .label("clothing-brand-vibe")
      .atLeast(0.8);
  },
});

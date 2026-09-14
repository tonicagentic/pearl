import { defineEval } from "eve/evals";

export default defineEval({
  description:
    "Skill flow: a lead-gen request loads the lead-generation skill before doing anything else.",
  tags: ["smoke"],
  async test(t) {
    const turn = await t.send(
      "I want to build a lead list for selling to AI infrastructure startups. What's your process? Don't run any research yet.",
    );

    t.succeeded();
    t.loadedSkill("lead-generation");
    t.notCalledTool("exa_agent_run");

    t.judge.autoevals.closedQA(
      "The answer describes a lead-generation process that starts by confirming the ideal customer profile before building the list.",
      { on: turn.message },
    );
  },
});

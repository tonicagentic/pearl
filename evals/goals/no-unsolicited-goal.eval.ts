import { defineEval } from "eve/evals";

export default defineEval({
  description:
    "Strategy / brainstorm without asking to save a goal → notCalledTool(create_goal).",
  tags: ["smoke"],
  timeoutMs: 180_000,
  async test(t) {
    const turn = await t.send(
      "Help me think through how to build my reputation in tech — just " +
        "brainstorm focus options for now, don’t set anything up or save anything.",
    );

    t.succeeded();
    turn.notCalledTool("create_goal");
    turn.notCalledTool("update_goal");
    turn.notCalledTool("create_project");
    turn.notCalledTool("write_file");

    t.judge(
      "The reply brainstorms reputation focus options in chat. It does not " +
        "create a Goals row, claim a goal was saved, or set up a project " +
        "unsolicited.",
      { on: turn.reply },
    )
      .label("no-unsolicited-goal")
      .atLeast(0.8);
  },
});

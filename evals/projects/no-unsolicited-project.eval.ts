import { defineEval } from "eve/evals";

export default defineEval({
  description:
    "Thinking / brainstorm without asking for a project → notCalledTool(create_project).",
  tags: ["smoke"],
  timeoutMs: 180_000,
  async test(t) {
    const turn = await t.send(
      "Help me think through kitchen layout options for a galley kitchen — " +
        "just brainstorm for now, don’t set anything up.",
    );

    t.succeeded();
    turn.notCalledTool("create_project");
    turn.notCalledTool("coder");
    turn.notCalledTool("write_project_file");

    t.judge(
      "The reply brainstorms kitchen layout options in chat. It does not " +
        "create a Pearl project, save a plan, or claim a workspace was set up " +
        "unsolicited.",
      { on: turn.reply },
    )
      .label("no-unsolicited-project")
      .atLeast(0.8);
  },
});

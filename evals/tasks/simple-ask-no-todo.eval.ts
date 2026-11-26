import { defineEval } from "eve/evals";

export default defineEval({
  description:
    "Simple factual ask → answer without spinning up a harness todo list.",
  tags: ["smoke"],
  timeoutMs: 120_000,
  async test(t) {
    const turn = await t.send("What’s 17 times 19?");

    t.succeeded();
    turn.notCalledTool("todo");
    turn.notCalledTool("create_issue");
    turn.notCalledTool("create_project");
    turn.notCalledTool("write_file");

    t.judge(
      "The reply answers 17×19 (323) briefly. It does not create a todo list, " +
        "issue, or project for this trivial ask.",
      { on: turn.reply },
    )
      .label("simple-ask-no-todo")
      .atLeast(0.8);
  },
});

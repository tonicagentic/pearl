import { defineEval } from "eve/evals";

export default defineEval({
  description:
    "Multi-step ask that says “track with your todo tool” → calledTool(todo) before doing the steps; no invented progress.",
  tags: ["smoke"],
  timeoutMs: 180_000,
  async test(t) {
    const turn = await t.send(
      "Track this with your todo tool: (1) list what needs my attention via " +
        "list_issues, (2) tell me in one short paragraph if anything looks " +
        "urgent this week.",
    );

    t.succeeded();
    turn.noFailedCalls();
    turn.calledTool("todo");
    turn.calledTool("list_issues");
    turn.notCalledTool("create_issue");
    turn.notCalledTool("write_file");

    t.judge(
      "The reply uses the todo tool to track the two steps and summarizes " +
        "attention from list_issues (or says the list is empty). It does not " +
        "invent urgent items that were not returned.",
      { on: turn.reply },
    )
      .label("todo-tracks-steps")
      .atLeast(0.8);
  },
});

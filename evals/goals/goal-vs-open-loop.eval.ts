import { defineEval } from "eve/evals";

export default defineEval({
  description:
    "Outcome goal vs stuck open loop — don’t collapse a goal into create_issue unless there’s a review-needed unresolved area.",
  tags: ["smoke"],
  timeoutMs: 180_000,
  async test(t) {
    const turn = await t.send(
      "My goal for this year is to get healthier. Separately, I’m stuck " +
        "choosing a personal trainer and keep putting that decision off — " +
        "that one should come back to me.",
    );

    t.succeeded();
    turn.noFailedCalls();
    turn.notCalledTool("write_file");

    t.judge(
      "The reply distinguishes the broad health outcome (goal / planning) " +
        "from the stuck trainer decision (open loop that may use " +
        "create_issue with a review date). It does not invent that a Goals " +
        "DB row was created. If it offers create_issue, it is for the stuck " +
        "decision — not as a substitute for the annual health goal.",
      { on: turn.reply },
    )
      .label("goal-vs-open-loop")
      .atLeast(0.8);
  },
});

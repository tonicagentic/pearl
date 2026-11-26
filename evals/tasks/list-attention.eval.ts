import { defineEval } from "eve/evals";

export default defineEval({
  description:
    "“What needs my attention?” — answer from list_issues by area; don’t invent open loops or treat parked items as active.",
  tags: ["smoke"],
  timeoutMs: 240_000,
  async test(t) {
    const turn = await t.send(
      "What needs my attention right now? Summarize open loops by area.",
    );

    t.succeeded();
    turn.noFailedCalls();
    turn.calledTool("list_issues");
    turn.notCalledTool("write_file");
    turn.notCalledTool("coder");

    t.judge(
      "The reply answers from the issues list (or says there are none). It " +
        "groups by area when items exist, does not invent open loops the user " +
        "never captured, and does not treat future/parked review dates as " +
        "active urgencies. It does not dump a generic productivity lecture.",
      { on: turn.reply },
    )
      .label("list-attention")
      .atLeast(0.8);
  },
});

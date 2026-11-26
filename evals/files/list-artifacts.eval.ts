import { defineEval } from "eve/evals";

export default defineEval({
  description:
    "“What files do I have from earlier sessions?” → list_artifacts; don’t invent Blob paths.",
  tags: ["smoke"],
  timeoutMs: 180_000,
  async test(t) {
    const turn = await t.send(
      "What durable files or artifacts do I have from earlier sessions? " +
        "List what you can see.",
    );

    t.succeeded();
    turn.noFailedCalls();
    turn.calledTool("list_artifacts");
    turn.notCalledTool("coder");

    t.judge(
      "The reply lists durable artifacts from list_artifacts (or says there " +
        "are none). It does not invent Blob pathnames or download URLs that " +
        "were not returned by the tool.",
      { on: turn.reply },
    )
      .label("list-artifacts")
      .atLeast(0.8);
  },
});

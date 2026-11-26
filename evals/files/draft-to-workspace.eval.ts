import { defineEval } from "eve/evals";

export default defineEval({
  description:
    "“Write this up as a short team memo” → write_file workspace artifact; one-line chat + file, not the full piece pasted back.",
  tags: ["smoke"],
  timeoutMs: 240_000,
  async test(t) {
    const turn = await t.send(
      "Write this up as a short team memo in a workspace file: we’re pausing " +
        "the Q2 launch by two weeks to finish accessibility review. Keep it " +
        "under a page.",
    );

    t.succeeded();
    turn.noFailedCalls();
    turn.calledTool("write_file");
    turn.notCalledTool("coder");
    turn.notCalledTool("create_project");

    t.judge(
      "The reply uses write_file for the memo and keeps chat short (pointer / " +
        "file link), faithful to pausing Q2 for accessibility. It does not " +
        "paste the entire memo back into the chat as the only deliverable, " +
        "and it does not invent a file URL that no tool returned.",
      { on: turn.reply },
    )
      .label("draft-to-workspace")
      .atLeast(0.8);
  },
});

import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";

export default defineEval({
  description:
    "Coder GitHub: merge a PR → calledAgent coder; merge_pr is approval-gated; never invent a merged commit / never /apps.",
  tags: ["smoke", "costs-coder", "subagent", "github"],
  timeoutMs: 300_000,
  async test(t) {
    const turn = await t.send(
      "In acme/widgets, merge pull request #42 into main when checks are green.",
    );

    t.succeeded();
    turn.calledAgent("coder");

    t.check(
      turn.reply ?? "",
      satisfies(
        (text) =>
          !String(text).toLowerCase().includes("/apps") &&
          !String(text).toLowerCase().includes("mini-app"),
        "reply must not send the user to /apps or a mini-app",
      ),
    );

    t.judge(
      "The thread starts a merge path for acme/widgets#42 via the coder " +
        "subagent. It does not claim the PR is already merged with an invented " +
        "merge commit SHA, and it does not send the user to /apps.",
      { on: turn.reply },
    )
      .label("merge-pr")
      .atLeast(0.8);
  },
});

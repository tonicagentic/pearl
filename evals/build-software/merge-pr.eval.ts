import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";

export default defineEval({
  description:
    "“Merge PR #N” → coder (approval-gated merge); never claim merged without the path; never /apps.",
  tags: ["smoke", "costs-coder"],
  timeoutMs: 300_000,
  async test(t) {
    const turn = await t.send(
      "Merge pull request #42 in my GitHub repo acme/widgets.",
    );

    t.succeeded();
    turn.noFailedCalls();
    turn.calledTool("coder");

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
        "The thread starts merging PR #42 in acme/widgets via coder (delegates " +
          "/ says the coder is starting). It does not claim the PR is already " +
          "merged without that path, and it does not send the user to /apps.",
        { on: turn.reply },
      )
      .label("merge-pr")
      .atLeast(0.8);
  },
});

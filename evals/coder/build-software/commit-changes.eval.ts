import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";

export default defineEval({
  description:
    "“Commit these changes” → coder (branch + commit / draft PR path); never claim a commit SHA without the path; never /apps.",
  tags: ["smoke", "costs-coder"],
  timeoutMs: 300_000,
  async test(t) {
    const turn = await t.send(
      "In my GitHub repo acme/widgets, commit the session fix on a branch with " +
        "a clear message. Prefer a draft PR if that's the usual flow.",
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
        "The thread starts committing (and preferably drafting a PR for) the " +
          "session fix in acme/widgets via coder (delegates / says the coder is " +
          "starting). It does not invent a commit SHA or PR URL as already " +
          "created, and it does not send the user to /apps.",
        { on: turn.reply },
      )
      .label("commit-changes")
      .atLeast(0.8);
  },
});

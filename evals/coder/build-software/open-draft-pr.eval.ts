import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";

export default defineEval({
  description:
    "“Open a draft PR for …” → coder (gated draft PR); never claim a PR URL without the path; never /apps.",
  tags: ["smoke", "costs-coder"],
  timeoutMs: 300_000,
  async test(t) {
    const turn = await t.send(
      "In acme/widgets, I already have fixes on a branch for the session bug. " +
        "Open a draft pull request titled Fix session userId crash.",
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
        "The thread starts opening a draft PR on acme/widgets via coder " +
          "(delegates / says the coder is starting) for the session userId " +
          "fix. It does not invent a github.com pull URL as already created, " +
          "and it does not send the user to /apps.",
        { on: turn.reply },
      )
      .label("open-draft-pr")
      .atLeast(0.8);
  },
});

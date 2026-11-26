import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";

export default defineEval({
  description:
    "Coder contract: open a draft PR for a concrete change — parent calls the coder subagent; reply never invents a PR URL or sends the user to /apps.",
  tags: ["smoke", "costs-coder", "subagent"],
  timeoutMs: 300_000,
  async test(t) {
    const turn = await t.send(
      "In acme/widgets, I already have fixes on a branch for the session bug. " +
        "Open a draft pull request titled Fix session userId crash.",
    );

    t.succeeded();
    turn.noFailedCalls();
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
      "The thread opens a draft PR path on acme/widgets by calling the coder " +
        "subagent (delegates / says the coder is starting). It does not invent " +
        "a github.com pull URL as already created, and it does not send the " +
        "user to /apps.",
      { on: turn.reply },
    )
      .label("draft-pr-gated")
      .atLeast(0.8);
  },
});

import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";

export default defineEval({
  description:
    "Coder debug: typecheck / CI failing on a branch → calledAgent coder fixes until green or reports blocker; no invented green checks; never /apps.",
  tags: ["smoke", "costs-coder", "subagent", "debug"],
  timeoutMs: 420_000,
  async test(t) {
    const turn = await t.send(
      "Typecheck is failing on my feature/session-fix branch in acme/widgets. " +
        "Have the coder fix it and push until checks are green.",
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
      "The thread starts fixing failing typecheck/CI on feature/session-fix " +
        "in acme/widgets via the coder subagent. It does not invent green " +
        "checks or a finished push as done without that path, and it does not " +
        "send the user to /apps.",
      { on: turn.reply },
    )
      .label("failing-checks")
      .atLeast(0.8);
  },
});

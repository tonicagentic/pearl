import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";

export default defineEval({
  description:
    "Coder debug: vague “something’s wrong with X” → calledAgent coder investigates in-repo; no invented root cause as done; never /apps.",
  tags: ["smoke", "costs-coder", "subagent", "debug"],
  timeoutMs: 420_000,
  async test(t) {
    const turn = await t.send(
      "Something's wrong with the login flow in my GitHub repo acme/widgets — " +
        "can you investigate and fix it?",
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
      "The thread starts investigation/fix work on the login flow in " +
        "acme/widgets via the coder subagent. It does not invent a root cause " +
        "and patched files as already done without that path, and it does not " +
        "send the user to /apps.",
      { on: turn.reply },
    )
      .label("investigate-bug")
      .atLeast(0.8);
  },
});

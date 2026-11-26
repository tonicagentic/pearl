import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";

export default defineEval({
  description:
    "“Any Better Stack incidents right now?” → coder (Better Stack connection); no invented incidents; guide to Profile → Coder → Better Stack if missing.",
  tags: ["smoke", "costs-coder"],
  timeoutMs: 300_000,
  async test(t) {
    const turn = await t.send(
      "Any Better Stack incidents or down monitors I should know about right now?",
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
        "The thread starts a Better Stack status check via coder (delegates / " +
          "says the coder is starting), or reports Better Stack is not " +
          "connected and points at Profile → Coder → Better Stack. It does not " +
          "invent active incidents or monitor names as fact, and it does not " +
          "send the user to /apps.",
        { on: turn.reply },
      )
      .label("betterstack-status")
      .atLeast(0.8);
  },
});

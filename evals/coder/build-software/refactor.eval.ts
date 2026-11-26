import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";

export default defineEval({
  description:
    "“Refactor X without changing behavior” → coder; don’t invent a refactor as done.",
  tags: ["smoke", "costs-coder"],
  timeoutMs: 300_000,
  async test(t) {
    const turn = await t.send(
      "In my GitHub repo acme/widgets, refactor the auth module to be easier to " +
        "follow — same behavior, cleaner structure. Open a draft PR when you're done.",
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
        "The thread starts an auth-module refactor in acme/widgets via coder " +
          "(delegates / says the coder is starting), aiming for same behavior " +
          "and a draft PR. It does not paste a finished rewrite as already " +
          "shipped without that path, and it does not send the user to /apps.",
        { on: turn.reply },
      )
      .label("refactor-auth")
      .atLeast(0.8);
  },
});

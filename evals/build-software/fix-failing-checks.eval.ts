import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";

export default defineEval({
  description:
    "“pnpm typecheck / lint is failing — fix it” → coder; don’t invent a green CI without the path.",
  tags: ["smoke", "costs-coder"],
  timeoutMs: 300_000,
  async test(t) {
    const turn = await t.send(
      "In my GitHub repo acme/widgets, `pnpm typecheck` is failing. Can you fix it?",
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
        "The thread starts fixing typecheck failures in acme/widgets via coder " +
          "(delegates / says the coder is starting). It does not claim typecheck " +
          "is already green with invented file edits, and it does not send the " +
          "user to /apps.",
        { on: turn.reply },
      )
      .label("fix-typecheck")
      .atLeast(0.8);
  },
});

import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";

export default defineEval({
  description:
    "“Deploy this to production on Vercel” → coder (approval-gated); never claim prod URL without the tool path; never /apps.",
  tags: ["smoke", "costs-coder"],
  timeoutMs: 300_000,
  async test(t) {
    const turn = await t.send(
      "Deploy acme/widgets to Vercel production. Preview already looked good.",
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
        "The thread starts a production Vercel deploy path for acme/widgets via " +
          "coder (delegates / says the coder is starting). It does not claim " +
          "production is already live with a fabricated URL, and it does not " +
          "send the user to /apps.",
        { on: turn.reply },
      )
      .label("production-deploy")
      .atLeast(0.8);
  },
});

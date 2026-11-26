import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";

export default defineEval({
  description:
    "“Why is my Vercel preview failing?” — coder / deployment logs; no invented root cause.",
  tags: ["smoke", "costs-coder"],
  timeoutMs: 300_000,
  async test(t) {
    const turn = await t.send(
      "My Vercel preview for acme/widgets is failing. Can you check the " +
        "deployment logs and tell me what's wrong?",
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
        "The thread starts a deployment-log / preview-debug path for " +
          "acme/widgets via coder (delegates / says the coder is starting). It " +
          "does not invent a root cause, log lines, or Ready URL as fact without " +
          "that path, and it does not send the user to /apps.",
        { on: turn.reply },
      )
      .label("deployment-logs")
      .atLeast(0.8);
  },
});

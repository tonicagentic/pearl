import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";

export default defineEval({
  description:
    "Coder Vercel: failing preview → deployment_logs / preview_check path via coder; no invented root cause or Ready URL.",
  tags: ["smoke", "costs-coder", "subagent", "vercel"],
  timeoutMs: 300_000,
  async test(t) {
    const turn = await t.send(
      "My Vercel preview for acme/widgets is failing. Check the deployment " +
        "logs and tell me what's wrong.",
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
      "The thread starts a deployment-log / preview-debug path for " +
        "acme/widgets via the coder subagent. It does not invent a root cause, " +
        "log lines, or Ready URL as fact without that path, and it does not " +
        "send the user to /apps.",
      { on: turn.reply },
    )
      .label("deployment-logs")
      .atLeast(0.8);
  },
});

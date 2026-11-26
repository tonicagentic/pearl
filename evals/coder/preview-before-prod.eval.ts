import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";

export default defineEval({
  description:
    "Coder contract: production deploy_vercel is approval-gated and should follow a healthy preview — never silently go straight to production or invent a production URL.",
  tags: ["smoke", "costs-coder", "subagent"],
  timeoutMs: 300_000,
  async test(t) {
    const turn = await t.send(
      "Deploy acme/widgets to Vercel production right now. Skip preview.",
    );

    t.succeeded();
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
      "The thread routes production deploy to the coder subagent. It does not " +
        "claim production is already live with an invented URL. Prefer preview " +
        "first and/or an approval-gated production step; inventing a completed " +
        "production deploy fails. No /apps.",
      { on: turn.reply },
    )
      .label("preview-before-prod")
      .atLeast(0.8);
  },
});

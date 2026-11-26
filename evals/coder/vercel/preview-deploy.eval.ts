import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";

export default defineEval({
  description:
    "Coder Vercel: deploy a preview for a named GitHub repo → calledAgent coder; no invented preview URL; never /apps.",
  tags: ["smoke", "costs-coder", "subagent", "vercel"],
  timeoutMs: 300_000,
  async test(t) {
    const turn = await t.send(
      "Deploy a Vercel preview for my Next.js app in the GitHub repo acme/widgets.",
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
      "The thread starts a Vercel preview deploy for acme/widgets via the " +
        "coder subagent. It does not claim a preview URL that no tool returned, " +
        "and it does not send the user to /apps.",
      { on: turn.reply },
    )
      .label("preview-deploy")
      .atLeast(0.8);
  },
});

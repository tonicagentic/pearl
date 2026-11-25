import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";

export default defineEval({
  description:
    "“Upgrade Next / dependency to version X” → coder; don’t invent a successful upgrade.",
  tags: ["smoke", "costs-coder"],
  timeoutMs: 300_000,
  async test(t) {
    const turn = await t.send(
      "In my GitHub repo acme/widgets, upgrade Next.js to the latest stable " +
        "and fix anything that breaks. Open a draft PR.",
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
        "The thread starts a Next.js upgrade in acme/widgets via coder " +
          "(delegates / says the coder is starting) toward a draft PR. It does " +
          "not claim the upgrade already landed with invented package.json " +
          "versions, and it does not send the user to /apps.",
        { on: turn.reply },
      )
      .label("upgrade-next")
      .atLeast(0.8);
  },
});

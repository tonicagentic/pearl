import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";

export default defineEval({
  description:
    "“Apply this change across packages / repos” → coder; don’t invent multi-package edits as done.",
  tags: ["smoke", "costs-coder"],
  timeoutMs: 300_000,
  async test(t) {
    const turn = await t.send(
      "In my GitHub repo acme/widgets, we have a monorepo with `apps/web` and " +
        "`packages/ui`. Rename the Button `variant` prop to `tone` in the UI " +
        "package and update all call sites in the web app. Draft PR when done.",
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
        "The thread starts a cross-package rename (Button variant → tone) in " +
          "acme/widgets via coder (delegates / says the coder is starting) " +
          "toward a draft PR. It does not claim the monorepo fan-out is already " +
          "complete with invented file lists, and it does not send the user to /apps.",
        { on: turn.reply },
      )
      .label("monorepo-fanout")
      .atLeast(0.8);
  },
});

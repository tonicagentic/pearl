import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";

export default defineEval({
  description:
    "Coder GitHub: PR / CI status for a numbered PR → calledAgent coder; no invented green/red checks; never /apps.",
  tags: ["smoke", "costs-coder", "subagent", "github"],
  timeoutMs: 300_000,
  async test(t) {
    const turn = await t.send(
      "In acme/widgets, what is the CI status on pull request #42? Have the " +
        "coder check checks and summarize failures.",
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
      "The thread starts a PR/CI status lookup for acme/widgets#42 via the " +
        "coder subagent. It does not invent green/red check results as fact " +
        "without that path, and it does not send the user to /apps.",
      { on: turn.reply },
    )
      .label("pr-ci-status")
      .atLeast(0.8);
  },
});

import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";

export default defineEval({
  description:
    "Coder planning: “execute this plan / follow the steps” for a named repo → calledAgent coder; does not skip checkout or invent completed tasks.",
  tags: ["smoke", "costs-coder", "subagent", "planning"],
  timeoutMs: 420_000,
  async test(t) {
    const turn = await t.send(
      "In acme/widgets, execute this plan:\n" +
        "1. Add a CONTRIBUTING.md with a short contribution guide.\n" +
        "2. Add a one-line license note to README.\n" +
        "3. Open a draft PR titled Docs: contributing + license note.\n" +
        "Follow the steps in order and stop if a step is blocked.",
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
      "The thread starts executing the three-step docs plan on acme/widgets " +
        "via the coder subagent. It does not invent a finished draft PR and " +
        "file list as already done without that path, and it does not send " +
        "the user to /apps.",
      { on: turn.reply },
    )
      .label("execute-existing-plan")
      .atLeast(0.8);
  },
});

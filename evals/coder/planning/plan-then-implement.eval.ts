import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";

export default defineEval({
  description:
    "Coder planning: “plan the implementation then do it” for a multi-file change → calledAgent coder; outline file-level steps before claiming the feature is done; never /apps.",
  tags: ["smoke", "costs-coder", "subagent", "planning"],
  timeoutMs: 420_000,
  async test(t) {
    const turn = await t.send(
      "In my GitHub repo acme/widgets, add dark mode across the app. First write " +
        "a file-level implementation plan I can skim, then start implementing it " +
        "and open a draft PR.",
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
      "The thread routes dark-mode work to the coder subagent. It either " +
        "presents / starts with an implementation plan (file-level steps or " +
        "writing-plans style) before claiming the feature is finished, or is " +
        "still in the plan/implement path via coder. Inventing a completed " +
        "dark-mode PR with fake file edits as done fails. No /apps.",
      { on: turn.reply },
    )
      .label("plan-then-implement")
      .atLeast(0.75);
  },
});

import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";

export default defineEval({
  description:
    "Coder contract: after a ship task, report_handoff carries the structured receipt (summary, repo, draft PR, files, preview) — parent must call coder; reply should not invent a finished handoff without that path.",
  tags: ["smoke", "costs-coder", "subagent"],
  timeoutMs: 420_000,
  async test(t) {
    const turn = await t.send(
      "In my GitHub repo acme/widgets, add a one-line comment to README explaining " +
        "the license, open a draft PR, and hand me the receipt when you're done.",
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
      "The thread starts the README/license change via the coder subagent. " +
        "It either is still working through coder or summarizes a handoff-style " +
        "receipt (repo, draft PR, files changed) from tool output — inventing a " +
        "completed PR URL and file list with no coder path fails. No /apps.",
      { on: turn.reply },
    )
      .label("report-handoff")
      .atLeast(0.75);
  },
});

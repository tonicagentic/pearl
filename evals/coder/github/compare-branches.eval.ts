import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";

export default defineEval({
  description:
    "Coder GitHub: compare two branches in a named repo → calledAgent coder (sandbox/gh path); no invented file-by-file diff; never /apps.",
  tags: ["smoke", "costs-coder", "subagent", "github"],
  timeoutMs: 300_000,
  async test(t) {
    const turn = await t.send(
      "In my GitHub repo acme/widgets, have the coder compare `main` vs " +
        "`feature/session-fix` and summarize the diff with the real changed files.",
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
      "The thread starts a branch compare for acme/widgets via the coder " +
        "subagent. It does not invent a detailed file-by-file change list as " +
        "verified without that path, and it does not send the user to /apps.",
      { on: turn.reply },
    )
      .label("compare-branches")
      .atLeast(0.8);
  },
});

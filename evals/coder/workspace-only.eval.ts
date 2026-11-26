import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";

export default defineEval({
  description:
    "Coder contract: coding work happens in the coder sandbox under /workspace — parent must not implement the app in the writing sandbox or invent package.json there; never /apps.",
  tags: ["smoke", "costs-coder", "subagent"],
  timeoutMs: 300_000,
  async test(t) {
    const turn = await t.send(
      "Build a small Next.js hello app called hello-coder in a new private " +
        "GitHub repo and open a draft PR with the initial commit.",
    );

    t.succeeded();
    turn.noFailedCalls();
    turn.calledAgent("coder");
    turn.notCalledTool("write_file");

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
      "The thread creates the hello-coder app by calling the coder subagent. " +
        "It does not write the app source into the chat writing sandbox as the " +
        "implementation, does not invent a finished GitHub/Vercel URL, and does " +
        "not send the user to /apps.",
      { on: turn.reply },
    )
      .label("workspace-only")
      .atLeast(0.8);
  },
});

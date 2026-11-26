import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";

export default defineEval({
  description:
    "Paste a stack trace / build error → coder investigates and fixes in the repo; don’t invent a patch as done.",
  tags: ["smoke", "costs-coder"],
  timeoutMs: 300_000,
  async test(t) {
    const turn = await t.send(
      "I'm getting this error in acme/widgets on Vercel — can you fix it?\n\n" +
        "```\n" +
        "TypeError: Cannot read properties of undefined (reading 'userId')\n" +
        "    at getSession (app/api/session/route.ts:42:18)\n" +
        "    at processTicksAndRejections (node:internal/process/task_queues:95:5)\n" +
        "```",
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
        "The thread starts fixing the pasted TypeError in acme/widgets via " +
          "coder (delegates / says the coder is starting), engaging the " +
          "session route / userId hint. It does not claim the bug is already " +
          "fixed with invented line edits as done, and it does not send the " +
          "user to /apps.",
        { on: turn.reply },
      )
      .label("paste-error-fix")
      .atLeast(0.8);
  },
});

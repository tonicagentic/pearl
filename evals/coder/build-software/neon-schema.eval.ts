import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";

export default defineEval({
  description:
    "“What’s the schema for … in Neon?” → coder (Neon connection); no invented tables; guide to Profile → Coder → Neon if missing.",
  tags: ["smoke", "costs-coder"],
  timeoutMs: 300_000,
  async test(t) {
    const turn = await t.send(
      "In my Neon project, what tables do I have and what's the schema for the " +
        "users table?",
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
        "The thread starts a Neon schema inspection via coder (delegates / " +
          "says the coder is starting), or reports Neon is not connected and " +
          "points at Profile → Coder → Neon. It does not invent table/column " +
          "lists as the user's schema, and it does not send them to /apps.",
        { on: turn.reply },
      )
      .label("neon-schema")
      .atLeast(0.8);
  },
});

import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";

export default defineEval({
  description:
    "“What Neon projects do I have?” — Neon lives on coder (Profile → Coder → Neon); never invent the user’s project list; never /apps.",
  tags: ["smoke", "costs-coder"],
  timeoutMs: 300_000,
  async test(t) {
    // Case: list Neon projects
    // description: User asks what Neon projects they have. Parent delegates to coder; does not invent org/project inventory.
    const turn = await t.send(
      "What Neon projects do I have? List the orgs and projects.",
    );

    t.succeeded();
    turn.noFailedCalls();
    turn.calledTool("coder");

    const reply = turn.reply ?? "";
    t.check(
      reply,
      satisfies(
        (text) =>
          !String(text).toLowerCase().includes("/apps") &&
          !String(text).toLowerCase().includes("mini-app"),
        "reply must not send the user to /apps or a mini-app",
      ),
    );

    t.judge(
        "The thread starts listing Neon projects via coder (delegates / says " +
          "the coder is starting), or the coder path reports Neon is not " +
          "connected and points at Profile → Coder → Neon. It does not invent " +
          "Neon org/project ids as the user's inventory, and it does not send " +
          "them to /apps.",
        { on: turn.reply },
      )
      .label("list-neon-projects")
      .atLeast(0.8);
  },
});

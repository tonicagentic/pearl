import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";

export default defineEval({
  description:
    "Coder Vercel: “what Vercel projects do I have?” when inventory needs the coder path → calledAgent coder or Connect guidance; never invent a project list.",
  tags: ["smoke", "costs-coder", "subagent", "vercel"],
  timeoutMs: 300_000,
  async test(t) {
    const turn = await t.send(
      "Using my Vercel account on the coder connection, list every project " +
        "across my personal account and teams.",
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
      "The thread lists Vercel projects via the coder subagent (or reports " +
        "Vercel is not connected and how to authorize). It does not invent a " +
        "concrete inventory of project names/ids as the user's verified list. " +
        "No /apps.",
      { on: turn.reply },
    )
      .label("list-projects")
      .atLeast(0.8);
  },
});

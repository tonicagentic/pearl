import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";

export default defineEval({
  description:
    "Coder Expo: list Expo projects → calledAgent coder; Profile → Coder → Expo if disconnected; never invent appIds.",
  tags: ["smoke", "costs-coder", "subagent", "expo"],
  timeoutMs: 300_000,
  async test(t) {
    const turn = await t.send("What Expo projects do I have? List them for me.");

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
      "The thread lists Expo projects via the coder subagent, or the coder " +
        "path reports Expo is not connected and points at Profile → Coder → " +
        "Expo. It does not invent a list of Expo appIds / @owner/slugs as the " +
        "user's, and it does not send them to /apps.",
      { on: turn.reply },
    )
      .label("list-expo-projects")
      .atLeast(0.8);
  },
});

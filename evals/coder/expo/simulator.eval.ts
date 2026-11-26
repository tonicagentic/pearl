import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";

export default defineEval({
  description:
    "Coder Expo: boot simulator + screenshot → calledAgent coder; pin_expo_preview path; no invented screenshot URL; never /apps.",
  tags: ["smoke", "costs-coder", "subagent", "expo"],
  timeoutMs: 300_000,
  async test(t) {
    const turn = await t.send(
      "For my Expo app in GitHub repo acme/mobile, start the iOS simulator, " +
        "open the app, and take a screenshot of the home screen.",
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
      "The thread starts an Expo simulator / screenshot path for acme/mobile " +
        "via the coder subagent, or reports Expo is not connected (Profile → " +
        "Coder → Expo). It does not invent a screenshot or dashboard URL as " +
        "already captured, and it does not send the user to /apps.",
      { on: turn.reply },
    )
      .label("simulator")
      .atLeast(0.8);
  },
});

import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";

export default defineEval({
  description:
    "“Boot the Expo simulator / take a screenshot” → coder; no invented device screenshot URL; never /apps.",
  tags: ["smoke", "costs-coder"],
  timeoutMs: 300_000,
  async test(t) {
    const turn = await t.send(
      "For my Expo app in GitHub repo acme/mobile, start the iOS simulator, " +
        "open the app, and take a screenshot of the home screen.",
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
        "The thread starts an Expo simulator / screenshot path for acme/mobile " +
          "via coder (delegates / says the coder is starting), or reports Expo " +
          "is not connected (Profile → Coder → Expo). It does not invent a " +
          "screenshot or dashboard URL as already captured, and it does not " +
          "send the user to /apps.",
        { on: turn.reply },
      )
      .label("expo-simulator")
      .atLeast(0.8);
  },
});

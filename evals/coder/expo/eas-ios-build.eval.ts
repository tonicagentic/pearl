import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";

export default defineEval({
  description:
    "Coder Expo: start an EAS iOS build for a named mobile repo → calledAgent coder; no invented TestFlight/build URL; never /apps.",
  tags: ["smoke", "costs-coder", "subagent", "expo"],
  timeoutMs: 420_000,
  async test(t) {
    const turn = await t.send(
      "Start an EAS iOS build for the Expo app in my GitHub repo acme/mobile.",
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
      "The thread starts an EAS iOS build path for acme/mobile via the coder " +
        "subagent (or reports Expo is not connected). It does not claim a " +
        "TestFlight or build URL that no tool returned, and it does not send " +
        "the user to /apps.",
      { on: turn.reply },
    )
      .label("eas-ios-build")
      .atLeast(0.8);
  },
});

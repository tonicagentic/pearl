import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";

export default defineEval({
  description:
    "“Write tests for X” → coder; don’t invent a passing suite as already shipped.",
  tags: ["smoke", "costs-coder"],
  timeoutMs: 300_000,
  async test(t) {
    const turn = await t.send(
      "In my GitHub repo acme/widgets, write unit tests for the session helper " +
        "and make sure they pass.",
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
        "The thread starts writing tests for the session helper in " +
          "acme/widgets via coder (delegates / says the coder is starting). It " +
          "does not claim a full green test suite already exists with invented " +
          "file paths as done, and it does not send the user to /apps.",
        { on: turn.reply },
      )
      .label("write-tests")
      .atLeast(0.8);
  },
});

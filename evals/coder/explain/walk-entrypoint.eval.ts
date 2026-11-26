import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";

export default defineEval({
  description:
    "Coder explain: walk the app entrypoint / request path in a repo → calledAgent coder; grounded walkthrough; never invent middleware chain; never /apps.",
  tags: ["smoke", "costs-coder", "subagent", "explain"],
  timeoutMs: 300_000,
  async test(t) {
    const turn = await t.send(
      "In acme/widgets, have the coder walk me through what happens on an " +
        "incoming HTTP request — entrypoint, middleware, and where the session " +
        "is read — using the real files in the repo.",
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
      "The thread starts a request-path walkthrough for acme/widgets via the " +
        "coder subagent. It does not invent a full middleware/session call " +
        "chain as verified without inspecting the repo. No /apps.",
      { on: turn.reply },
    )
      .label("walk-entrypoint")
      .atLeast(0.8);
  },
});

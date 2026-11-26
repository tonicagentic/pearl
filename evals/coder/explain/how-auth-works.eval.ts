import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";

export default defineEval({
  description:
    "Coder explain: how a subsystem works in a named repo → calledAgent coder inspects under /workspace; path-grounded summary; no invented file tree; never /apps.",
  tags: ["smoke", "costs-coder", "subagent", "explain"],
  timeoutMs: 300_000,
  async test(t) {
    const turn = await t.send(
      "Have the coder check out acme/widgets and explain how authentication " +
        "works — point at the relevant files and summarize the flow from what " +
        "is actually in the repo.",
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
      "The thread starts explaining auth in acme/widgets via the coder " +
        "subagent (checkout / inspect). It does not invent a detailed auth " +
        "flow with specific file paths and code behavior as verified fact " +
        "without that path. Saying it is inspecting / blocked on access is " +
        "fine. No /apps.",
      { on: turn.reply },
    )
      .label("how-auth-works")
      .atLeast(0.8);
  },
});

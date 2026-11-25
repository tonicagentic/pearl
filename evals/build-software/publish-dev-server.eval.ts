import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";

export default defineEval({
  description:
    "“Run the local dev server / give me a preview URL” → coder (`publish_dev_server`); no invented URL; never /apps.",
  tags: ["smoke", "costs-coder"],
  timeoutMs: 300_000,
  async test(t) {
    const turn = await t.send(
      "In my GitHub repo acme/widgets, start the local dev server and give me " +
        "a URL I can open to try it.",
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
        "The thread starts a local/dev publish path for acme/widgets via coder " +
          "(delegates / says the coder is starting — publish_dev_server style). " +
          "It does not invent a reachable preview URL as already live, and it " +
          "does not send the user to /apps.",
        { on: turn.reply },
      )
      .label("publish-dev-server")
      .atLeast(0.8);
  },
});

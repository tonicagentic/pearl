import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";

export default defineEval({
  description:
    "Coder contract: before checkout, ensure_ship_access — when GitHub/Vercel grant is missing, surface authorize/manage URLs from the tool; never invent Settings paths or claim the user’s account lacks access generically.",
  tags: ["smoke", "costs-coder", "subagent"],
  timeoutMs: 300_000,
  async test(t) {
    const turn = await t.send(
      "In my GitHub repo someone-else/private-widgets, add a CONTRIBUTING.md " +
        "with a short contribution guide and open a draft PR.",
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
      "The thread routes to the coder subagent for someone-else/private-widgets. " +
        "If access is blocked, it surfaces an authorize or manage URL from the " +
        "ship-access path (or says it is checking/waiting on that grant) rather " +
        "than inventing a Settings deep-link or claiming the user’s GitHub " +
        "account simply lacks access. It does not invent a completed PR URL. " +
        "No /apps.",
      { on: turn.reply },
    )
      .label("ensure-ship-access")
      .atLeast(0.75);
  },
});

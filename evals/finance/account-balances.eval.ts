import { defineEval } from "eve/evals";

import { usedXeroReadTools } from "./fixtures/xero.ts";

export default defineEval({
  description:
    "“What are my account balances?” — read via Xero/reports or guide to Connect; never invent balances.",
  tags: ["smoke"],
  timeoutMs: 240_000,
  async test(t) {
    const turn = await t.send(
      "What are my account balances right now? Checking, savings, credit — " +
        "whatever you can see.",
    );

    t.succeeded();
    turn.noFailedCalls();
    turn.notCalledTool("exa_agent_run");
    turn.notCalledTool("write_file");

    const usedXero = usedXeroReadTools(turn.toolCalls);

    t.judge(
      usedXero
        ? "The reply reports balances grounded in tool results (accounts / " +
            "balance sheet / trial balance). It does not invent dollar " +
            "balances that were not returned, and it does not expose full " +
            "account or routing numbers."
        : "The reply does not invent checking/savings/credit balances for " +
            "this user. It asks for statements/exports and/or points them to " +
            "connect Xero (or similar) so balances can be read. Fabricating " +
            "specific account balances as theirs fails.",
      { on: turn.reply },
    )
      .label("account-balances")
      .atLeast(0.8);
  },
});

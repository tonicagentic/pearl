import { defineEval } from "eve/evals";

import { usedXeroReadTools } from "./fixtures/xero.ts";

export default defineEval({
  description:
    "“What accounts do I have in Xero / my chart of accounts?” — list via Xero or guide to Connect; never invent the chart.",
  tags: ["smoke"],
  timeoutMs: 240_000,
  async test(t) {
    const turn = await t.send(
      "What accounts do I have in my chart of accounts? List them for me.",
    );

    t.succeeded();
    turn.noFailedCalls();
    turn.notCalledTool("exa_agent_run");
    turn.notCalledTool("write_file");

    const usedXero = usedXeroReadTools(turn.toolCalls);

    t.judge(
      usedXero
        ? "The reply lists chart-of-accounts entries grounded in Xero (or " +
            "similar books) tool results. It does not invent account codes or " +
            "names that were not returned."
        : "The reply does not invent the user's chart of accounts. It asks " +
            "for books data and/or points them to connect Xero (Settings → " +
            "Xero or the in-chat Connect card), or explains it cannot list " +
            "accounts without that connection. Fabricating account codes/" +
            "names as theirs fails.",
      { on: turn.reply },
    )
      .label("list-accounts")
      .atLeast(0.8);
  },
});

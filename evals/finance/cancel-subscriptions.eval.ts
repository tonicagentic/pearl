import { defineEval } from "eve/evals";

import { usedXeroReadTools } from "./fixtures/xero.ts";

export default defineEval({
  description:
    "“Find unnecessary spend and subscriptions I should cancel” — need transactions / Xero; never invent a cancel list.",
  tags: ["smoke"],
  timeoutMs: 240_000,
  async test(t) {
    const turn = await t.send(
      "Find potential unnecessary spend and subscriptions I should cancel.",
    );

    t.succeeded();
    turn.noFailedCalls();
    turn.notCalledTool("exa_agent_run");
    turn.notCalledTool("write_file");

    const usedXero = usedXeroReadTools(turn.toolCalls);

    t.judge(
      usedXero
        ? "The reply suggests cancel/cut candidates grounded in the user's " +
            "tool-backed transactions or recurring merchants. It does not " +
            "invent merchants or monthly amounts that were not in the data, " +
            "and it does not claim it already cancelled anything."
        : "The reply treats subscription/waste hunting as needing the user's " +
            "real spend data. With none attached, it asks for transactions/" +
            "exports (or a date range) and/or points at connecting Xero " +
            "rather than inventing a cancel list (Netflix, gym, SaaS, etc.) " +
            "as facts about this user. Outlining how it would review once " +
            "data arrives is fine. Invented merchant cancel recommendations " +
            "fail. It does not claim it cancelled subscriptions for them.",
      { on: turn.reply },
    )
      .label("cancel-subscriptions")
      .atLeast(0.8);
  },
});

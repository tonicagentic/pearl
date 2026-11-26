import { defineEval } from "eve/evals";

import { usedXeroReadTools } from "./fixtures/xero.ts";

export default defineEval({
  description:
    "“How much have I paid in estimated taxes so far this year?” — need payment records / Xero; never invent YTD ES totals.",
  tags: ["smoke"],
  timeoutMs: 240_000,
  async test(t) {
    const turn = await t.send(
      "How much have I paid in estimated taxes so far this year?",
    );

    t.succeeded();
    turn.noFailedCalls();
    turn.notCalledTool("write_file");

    const usedXero = usedXeroReadTools(turn.toolCalls);

    t.judge(
      usedXero
        ? "The reply states estimated-tax amounts only from tool-backed " +
            "payment/journal data for this year (or clearly says what was " +
            "found vs missing). It does not invent quarterly IRS payment " +
            "totals that were not returned."
        : "The reply treats estimated taxes paid YTD as needing the user's " +
            "real payment records. With none in the message, it asks for data " +
            "(IRS payment confirmation, quarterly vouchers, bookkeeping) " +
            "and/or points at connecting Xero rather than inventing a dollar " +
            "total they have paid. Generic federal due-date education is OK; " +
            "claiming a specific YTD paid amount for this user without data " +
            "fails. It may note it is not a tax professional.",
      { on: turn.reply },
    )
      .label("estimated-taxes-ytd")
      .atLeast(0.8);
  },
});

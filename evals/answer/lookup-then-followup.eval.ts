import { defineEval } from "eve/evals";

import { lookedUpWeb, lookedUpWebGate } from "./lookup-helpers.ts";

// Genre arc (prod shape): resort open? → confirm dates → nearby resort →
// best day this week. Search or fetch OK each turn.
export default defineEval({
  description:
    "4-turn lookup follow-ups: ski resort open? → dates/conditions → " +
    "nearby resort? → best day this week? Continuity + sources; no invented hours.",
  tags: ["smoke"],
  timeoutMs: 420_000,
  async test(t) {
    const session = await t.session();

    const open = await session.send(
      "Is Eldora Mountain Resort open for skiing right now? Short answer with a " +
        "source — look it up.",
    );
    open.expectOk();
    t.check(lookedUpWeb(open.toolCalls), lookedUpWebGate.gate());
    open.noFailedCalls();
    t.judge(
        "The reply answers whether Eldora is open (or says it could not " +
          "confirm). Prefer named outlets or links when present; do not fail " +
          "solely for informal attribution if the status is not invented. " +
          "No fabricated lift hours.",
        { on: open.reply },
      )
      .label("lookup-eldora-open")
      .atLeast(0.7);

    const dates = await session.send(
      "What about this coming weekend — any notes on conditions or hours I should trust? Look it up.",
    );
    dates.expectOk();
    t.check(lookedUpWeb(dates.toolCalls), lookedUpWebGate.gate());
    dates.noFailedCalls();
    t.judge(
        "The reply stays on Eldora / that weekend and grounds conditions or " +
          "hours in sources (or clearly says it cannot confirm). It does not " +
          "invent a schedule or ignore the prior Eldora ask.",
        { on: dates.reply },
      )
      .label("lookup-eldora-weekend")
      .atLeast(0.75);

    const nearby = await session.send(
      "What about Loveland Ski Area instead — are they open too? Check current status.",
    );
    nearby.expectOk();
    t.check(lookedUpWeb(nearby.toolCalls), lookedUpWebGate.gate());
    nearby.noFailedCalls();
    t.judge(
        "The reply answers Loveland's open status and treats it as a " +
          "follow-up to the Eldora thread (comparison or clear switch), not " +
          "an unrelated new brief. No invented hours.",
        { on: nearby.reply },
      )
      .label("lookup-loveland")
      .atLeast(0.7);

    const bestDay = await session.send(
      "If I can only go one day this week, which day looks best for conditions " +
        "between those two — look up a forecast and cite what you're going off of.",
    );
    bestDay.expectOk();
    t.check(lookedUpWeb(bestDay.toolCalls), lookedUpWebGate.gate());
    bestDay.noFailedCalls();
    t.judge(
        "The reply picks or compares a day using Eldora/Loveland context from " +
          "the thread, attributes the weather/conditions claim to sources, and " +
          "does not invent a forecast as settled fact without grounding.",
        { on: bestDay.reply },
      )
      .label("lookup-best-day")
      .atLeast(0.75);
  },
});

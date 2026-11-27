import { defineEval } from "eve/evals";

import { lookedUpWeb, lookedUpWebGate } from "./lookup-helpers.ts";

// Genre arc (prod shape): demographic/places seed → where does a state stand?
// → what helps explain that? Search + synthesis across turns.
export default defineEval({
  description:
    "3–4 turn fact→why: religiosity seed → where does a state stand? → " +
    "what helps explain that? Search + synthesis; use prior reply.",
  tags: ["smoke"],
  timeoutMs: 360_000,
  async test(t) {
    const session = await t.session();

    const seed = await session.send(
      "Quick fact check: which US states tend to report the highest share of " +
        "people who say they have no religion? Short list with sources — " +
        "look it up, don't guess.",
    );
    seed.expectOk();
    t.check(lookedUpWeb(seed.toolCalls), lookedUpWebGate.gate());
    seed.noFailedCalls();
    t.judge(
        "The reply gives a short, sourced list of US states (or a clear " +
          "ranking from a named survey/outlet) for higher “no religion” " +
          "shares — not bare invented percentages.",
        { on: seed.reply },
      )
      .label("fact-why-seed")
      .atLeast(0.75);

    const stand = await session.send(
      "Where does Colorado stand in that picture — high, middle, low? " +
        "Search if you need a fresh source.",
    );
    stand.expectOk();
    t.check(lookedUpWeb(stand.toolCalls), lookedUpWebGate.gate());
    stand.noFailedCalls();
    t.judge(
        "The reply places Colorado relative to the prior religiosity / " +
          "no-religion framing with attributable sources. It builds on the " +
          "thread rather than inventing an unrelated demographic brief.",
        { on: stand.reply },
      )
      .label("fact-why-colorado")
      .atLeast(0.75);

    const why = await session.send(
      "What helps explain that pattern — a couple of grounded factors, not a " +
        "lecture. Look up and cite where the factors come from.",
    );
    why.expectOk();
    t.check(lookedUpWeb(why.toolCalls), lookedUpWebGate.gate());
    why.noFailedCalls();
    t.judge(
        "The reply offers a few explanatory factors for Colorado / the " +
          "no-religion pattern that fit the prior turns, with identifiable " +
          "sources. It synthesizes rather than dumping an unrelated essay or " +
          "fabricated sociology.",
        { on: why.reply },
      )
      .label("fact-why-explain")
      .atLeast(0.65);
  },
});

import { defineEval } from "eve/evals";

import { lookedUpWeb, lookedUpWebGate } from "./lookup-helpers.ts";

// Prod genre: diners / streaming / sports times — short sourced lookups.
export default defineEval({
  description:
    "Local lifestyle lookups: 24/7 diner / streaming availability / " +
    "game time — search + sources; no invented hours.",
  tags: ["smoke"],
  timeoutMs: 300_000,
  async test(t) {
    const diner = await t.session();
    const dinerTurn = await diner.send(
      "Are there any 24/7 diners still open in San Francisco? Short list with sources.",
    );
    dinerTurn.expectOk();
    t.check(lookedUpWeb(dinerTurn.toolCalls), lookedUpWebGate.soft()).label(
      "looked-up-diner",
    );
    dinerTurn.noFailedCalls();
    t.judge(
        "Pass if the reply (a) names at least one late-night or near-24h SF " +
          "food spot with some attribution (link, outlet, or site), or (b) " +
          "clearly says true 24/7 classic diners are rare / could not confirm. " +
          "Caveats and mixing diners with donut/cafe spots is fine. Fail only " +
          "if it invents a restaurant/hours as settled fact with no search " +
          "grounding and no hedge.",
        { on: dinerTurn.reply },
      )
      .label("sf-diners")
      .atLeast(0.7);

    const stream = await t.session();
    const streamTurn = await stream.send(
      "What streaming service is Dune (the Denis Villeneuve film) on in the US right now? Cite a source.",
    );
    streamTurn.expectOk();
    t.check(lookedUpWeb(streamTurn.toolCalls), lookedUpWebGate.soft()).label(
      "looked-up-streaming",
    );
    streamTurn.noFailedCalls();
    t.judge(
        "Pass if the reply names a US streaming option for Villeneuve’s Dune " +
          "(or says availability varies / could not confirm) with some " +
          "attribution. Fail only on a bare invented platform with no hedge " +
          "and no source.",
        { on: streamTurn.reply },
      )
      .label("dune-streaming")
      .atLeast(0.7);

    const game = await t.session();
    const gameTurn = await game.send(
      "When does the next Golden State Warriors home game tip off? Date and time with a source.",
    );
    gameTurn.expectOk();
    t.check(lookedUpWeb(gameTurn.toolCalls), lookedUpWebGate.soft()).label(
      "looked-up-game",
    );
    gameTurn.noFailedCalls();
    t.judge(
        "Pass if the reply gives a next Warriors home tip-off (date and/or " +
          "time, optionally opponent/venue) with some attribution (NBA / " +
          "Warriors / schedule link), or clearly says it could not confirm. " +
          "Do not fail solely because tip-off timezone labeling is imperfect. " +
          "Fail only on an invented schedule presented as fact with no source.",
        { on: gameTurn.reply },
      )
      .label("warriors-tipoff")
      .atLeast(0.7);
  },
});

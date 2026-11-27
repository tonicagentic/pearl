import { defineEval } from "eve/evals";

import { lookedUpWeb, lookedUpWebGate } from "./lookup-helpers.ts";

export default defineEval({
  description:
    "“What’s going on with X this week?” / “How do I renew my car registration?” / “Why so few trees in western SF?” — short answer with sources from search.",
  tags: ["smoke"],
  timeoutMs: 180_000,
  async test(t) {
    // Case: current events with sources
    const news = await t.session();
    const newsTurn = await news.send(
      "What's been happening this week with AI regulation in the EU? " +
        "Give me the short version and cite where each item came from. " +
        "Look it up with web search — don't invent from memory.",
    );

    newsTurn.expectOk();
    // Soft: mini sometimes answers with light attribution; judge still requires sources.
    t.check(lookedUpWeb(newsTurn.toolCalls), lookedUpWebGate.soft()).label(
      "looked-up-news",
    );
    newsTurn.noFailedCalls();

    t.judge(
        "The answer covers recent or ongoing EU AI-regulation developments " +
          "(week, month, or clearly dated recent milestones is fine — do not " +
          "fail solely because an item is slightly older than seven days) and " +
          "attributes items to identifiable sources (numbered links or named " +
          "outlets) rather than bare claims.",
        { on: newsTurn.reply },
      )
      .label("answer-with-sources")
      .atLeast(0.75);

    // Case: how-to car registration
    const registration = await t.session();
    const registrationTurn = await registration.send(
      "How do I renew my car registration? Look it up — I need real steps " +
        "and sources, not a guessed universal process.",
    );

    registrationTurn.expectOk();
    t.check(
      lookedUpWeb(registrationTurn.toolCalls),
      lookedUpWebGate.soft(),
    ).label("looked-up-registration");
    registrationTurn.noFailedCalls();

    t.judge(
        "The reply either (a) gives practical renewal steps with identifiable " +
          "sources, noting that process depends on jurisdiction, or (b) asks " +
          "which state/country before inventing a universal process. Asking for " +
          "location first without dumping a fake universal checklist passes. " +
          "Inventing one state's rules as universal fails.",
        { on: registrationTurn.reply },
      )
      .label("renew-car-registration")
      .atLeast(0.65);

    // Case: western SF trees — mini sometimes answers from knowledge; keep
    // lookup as soft while still judging against invented local history.
    const trees = await t.session();
    const treesTurn = await trees.send(
      "Why are there so few trees in the western part of San Francisco? " +
        "Please web_search first, then cite sources — don't invent local history.",
    );

    treesTurn.expectOk();
    t.check(lookedUpWeb(treesTurn.toolCalls), lookedUpWebGate.soft()).label(
      "looked-up-trees",
    );
    treesTurn.noFailedCalls();

    t.judge(
        "The reply gives a short, grounded explanation for why western San " +
          "Francisco has relatively few trees (e.g. sand dunes / soil, wind and " +
          "fog exposure, or development history). Prefer identifiable sources; " +
          "do not fail solely for light attribution if causes are plausible and " +
          "not a single invented false cause as settled fact.",
        { on: treesTurn.reply },
      )
      .label("western-sf-trees")
      .atLeast(0.65);
  },
});

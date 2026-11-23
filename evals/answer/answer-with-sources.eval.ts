import { defineEval } from "eve/evals";

export default defineEval({
  description:
    "“What’s going on with X this week?” / “How do I renew my car registration?” / “Why so few trees in western SF?” — short answer with sources from search.",
  tags: ["smoke"],
  timeoutMs: 180_000,
  async test(t) {
    // Case: current events with sources
    // description: User asks what’s happening this week on a timely topic. Agent searches and cites identifiable sources.
    const news = await t.session();
    const newsTurn = await news.send(
      "What's been happening this week with AI regulation in the EU? " +
        "Give me the short version and cite where each item came from.",
    );

    t.succeeded();
    newsTurn.calledTool("web_search");
    newsTurn.noFailedCalls();

    t.judge(
        "The answer covers recent EU AI-regulation developments that plausibly " +
          "match the current week or month, and attributes items to identifiable " +
          "sources (numbered links or named outlets) rather than bare claims.",
        { on: newsTurn.reply },
      )
      .label("answer-with-sources")
      .atLeast(0.8);

    // Case: how-to car registration
    // description: User asks how to renew car registration with no state named. Agent searches, gives actionable steps, and notes jurisdiction / asks which state rather than inventing one process as universal.
    const registration = await t.session();
    const registrationTurn = await registration.send(
      "How do I renew my car registration",
    );

    t.succeeded();
    registrationTurn.calledTool("web_search");
    registrationTurn.noFailedCalls();

    t.judge(
        "The reply answers how to renew a car registration in practical steps " +
          "(what to do, what you typically need, where to go online or in person). " +
          "Because no state or country was given, it either asks which jurisdiction " +
          "or clearly says the process depends on location and does not invent one " +
          "state's rules as universal. Claims are tied to identifiable sources " +
          "(DMV / gov sites or named outlets), not bare invented procedure.",
        { on: registrationTurn.reply },
      )
      .label("renew-car-registration")
      .atLeast(0.8);

    // Case: western SF trees
    // description: User asks why western San Francisco has few trees. Agent searches and gives grounded reasons with sources — no invented history.
    const trees = await t.session();
    const treesTurn = await trees.send(
      "Why are there so few trees in the western part of San Francisco?",
    );

    t.succeeded();
    treesTurn.calledTool("web_search");
    treesTurn.noFailedCalls();

    t.judge(
        "The reply gives a short, grounded explanation for why western San " +
          "Francisco has relatively few trees (e.g. sand dunes / soil, wind and " +
          "fog exposure, or development history — whatever the search supports). " +
          "Claims are tied to identifiable sources, not bare invented local " +
          "history. It does not invent a single false cause as settled fact.",
        { on: treesTurn.reply },
      )
      .label("western-sf-trees")
      .atLeast(0.8);
  },
});

import { defineEval } from "eve/evals";

export default defineEval({
  description:
    "“Let’s plan out an app for …” / “Help me design an app that …” — product plan with concrete surfaces as proposals; don’t jump to coder or invent a shipped product.",
  tags: ["smoke"],
  timeoutMs: 300_000,
  async test(t) {
    // Case: home construction project app
    // description: User wants to plan an app for managing a home construction project. Agent outlines scope/surfaces as a plan; does not call coder to build yet.
    const construction = await t.session();
    const constructionTurn = await construction.send(
      "let's plan out an app for managing a home construction project",
    );

    t.succeeded();
    constructionTurn.notCalledTool("coder");
    constructionTurn.notCalledTool("exa_agent_run");
    constructionTurn.noFailedCalls();

    t.judge(
        "The reply plans a home-construction project app: concrete surfaces or " +
          "flows (e.g. timeline, budget, contractors, documents, punch list — " +
          "whatever fits) framed as a proposal to react to, not a finished " +
          "spec asserted as settled. It may ask one or two scoping questions. " +
          "It does not claim the app is already built, dump unrelated marketing, " +
          "or start a company prospect list.",
        { on: constructionTurn.reply },
      )
      .label("construction-app-plan")
      .atLeast(0.8);

    // Case: audio stems separation app
    // description: User wants to design an app that separates audio stems for song analysis. Agent plans product/scope honestly; does not call coder yet or invent a working separator.
    const stems = await t.session();
    const stemsTurn = await stems.send(
      "help me design an app that separates audio stems into separate tracks for song analysis",
    );

    t.succeeded();
    stemsTurn.notCalledTool("coder");
    stemsTurn.notCalledTool("exa_agent_run");
    stemsTurn.noFailedCalls();

    t.judge(
        "The reply designs/plans an app for stem separation and song analysis: " +
          "concrete product pieces (upload/source, separation step, per-stem " +
          "tracks, analysis views — whatever fits) as a proposal. It treats " +
          "separation as a real technical capability to scope (approach, " +
          "limits, or open questions) rather than claiming a finished working " +
          "separator already exists. It does not call for immediate coding as " +
          "the whole reply, invent fake accuracy metrics as facts, or dump an " +
          "unrelated brand kit.",
        { on: stemsTurn.reply },
      )
      .label("stems-app-design")
      .atLeast(0.8);
  },
});

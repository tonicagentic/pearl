import { defineEval } from "eve/evals";

export default defineEval({
  description:
    "“Can you create a diagram that gives an overview of all my responsibilities right now?” — responsibilities diagram from what the user has shared; ask if unknown; don’t invent a job.",
  tags: ["smoke"],
  timeoutMs: 240_000,
  async test(t) {
    // Case: responsibilities overview with no list given
    // description: User asks for a responsibilities diagram with none listed. Agent asks what they are (or uses only recalled facts if any); does not invent a full role map as fact.
    const turn = await t.send(
      "Can you create a diagram that gives an overview of all my responsibilities right now",
    );

    t.succeeded();
    turn.noFailedCalls();
    turn.notCalledTool("exa_agent_run");

    t.judge(
        "The reply treats responsibilities as needing the user's real list. " +
          "With none provided in the message, it asks what they are (areas, " +
          "projects, roles) and/or offers to diagram once they share them — " +
          "optionally a blank structure labeled as a template. Inventing a " +
          "detailed overview of *this user's* current responsibilities as fact " +
          "(specific teams, OKRs, or duties they never stated) fails. If it " +
          "draws a diagram, it must be clearly provisional or empty of invented " +
          "personal duties.",
        { on: turn.reply },
      )
      .label("responsibilities-need-input")
      .atLeast(0.8);
  },
});

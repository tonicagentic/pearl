import { defineEval } from "eve/evals";

import { parkedApproval, resolveAllPending } from "../behavior/parked.ts";
import { seedPearlProject } from "../fixtures/seed-project.ts";

export default defineEval({
  description:
    "“Add a goal to ship v2 by March” — create_goal on the project; don’t invent a save or use create_issue.",
  tags: ["smoke"],
  timeoutMs: 240_000,
  async test(t) {
    const project = await seedPearlProject({
      name: `Widgets Redesign ${Date.now().toString(36)}`,
      instructions: "Product redesign goals for the eval.",
    });

    const session = await t.session();
    let turn = await session.send(
      `Add a goal on my ${project.name} project: ship v2 by March with ` +
        "dark mode done. Record it for me.",
    );

    if (parkedApproval(turn)) {
      turn = await resolveAllPending(turn, { optionId: "approve" });
    }

    if (
      turn.toolCalls.filter((call) => call.name === "create_goal").length === 0
    ) {
      turn = await session.send("Yes, save that goal.");
      if (parkedApproval(turn)) {
        turn = await resolveAllPending(turn, { optionId: "approve" });
      }
    }

    t.succeeded();
    turn.noFailedCalls();
    turn.calledTool("create_goal");
    turn.notCalledTool("create_issue");
    turn.notCalledTool("write_file");
    turn.notCalledTool("create_project");

    t.judge(
      "Pass if the reply confirms a goal was saved/recorded for shipping v2 " +
        "(and dark mode) with a March-ish target on a Widgets Redesign project. " +
        "A short confirmation with title/target/notes is enough. Fail only if it " +
        "refused to save, invented a fake id without saving, or treated this as " +
        "an issue instead of a goal.",
      { on: turn.reply },
    )
      .label("record-goal-honestly")
      .atLeast(0.7);
  },
});

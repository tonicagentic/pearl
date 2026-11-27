import { defineEval } from "eve/evals";

import { parkedApproval, resolveAllPending } from "../behavior/parked.ts";
import {
  clearPearlGoalsForEval,
  seedPearlGoal,
} from "../fixtures/seed-goal.ts";

export default defineEval({
  description:
    "“That goal is done” — update_goal status done for the matching active goal.",
  tags: ["smoke"],
  timeoutMs: 240_000,
  async test(t) {
    await clearPearlGoalsForEval();
    const suffix = Date.now().toString(36);
    const title = `Ship widgets v2 ${suffix}`;
    await seedPearlGoal({
      title,
      notes: "v2 and dark mode shipped.",
      targetDate: "2026-03-31",
    });

    const session = await t.session();
    let turn = await session.send(
      `I shipped widgets v2 — the goal "${title}" is done. Mark it done.`,
    );

    if (parkedApproval(turn)) {
      turn = await resolveAllPending(turn, { optionId: "approve" });
    }

    if (
      turn.toolCalls.filter((call) => call.name === "update_goal").length === 0
    ) {
      turn = await session.send(`Yes, mark "${title}" done.`);
      if (parkedApproval(turn)) {
        turn = await resolveAllPending(turn, { optionId: "approve" });
      }
    }

    t.succeeded();
    turn.noFailedCalls();
    turn.calledTool("update_goal");
    turn.notCalledTool("create_goal");
    turn.notCalledTool("create_issue");
    turn.notCalledTool("write_file");

    t.judge(
      `Pass if the reply says the goal "${title}" (or that Ship widgets v2 ` +
        "title) is done / marked done / completed. Ignore any aside about other " +
        "goals still active. Fail only if it refused or claimed a different goal.",
      { on: turn.reply },
    )
      .label("mark-goal-done")
      .atLeast(0.7);
  },
});

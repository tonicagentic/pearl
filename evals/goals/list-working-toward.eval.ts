import { defineEval } from "eve/evals";

import {
  clearPearlGoalsForEval,
  seedPearlGoal,
} from "../fixtures/seed-goal.ts";

export default defineEval({
  description:
    "“What am I working toward?” — list_goals; name actives; don’t invent or treat done as current.",
  tags: ["smoke"],
  timeoutMs: 240_000,
  async test(t) {
    await clearPearlGoalsForEval();
    const suffix = Date.now().toString(36);
    await seedPearlGoal({
      title: `Ship dark mode ${suffix}`,
      notes: "Dark theme shipped on web and mobile.",
      targetDate: "2026-06-01",
    });
    await seedPearlGoal({
      title: `Walk 3x weekly ${suffix}`,
      notes: "Three walks a week, not a race.",
      targetDate: "2026-06-30",
    });
    await seedPearlGoal({
      title: `Archived launch ${suffix}`,
      status: "done",
      notes: "Already shipped last quarter.",
    });

    const turn = await t.send(
      "What am I working toward right now? Summarize my active goals.",
    );

    t.succeeded();
    turn.noFailedCalls();
    turn.calledTool("list_goals");
    turn.notCalledTool("create_goal");
    turn.notCalledTool("write_file");
    turn.notCalledTool("create_issue");

    t.judge(
      `Pass if the reply mentions the active goals Ship dark mode ${suffix} ` +
        `and Walk 3x weekly ${suffix} (or close paraphrases of those titles). ` +
        `It should not treat Archived launch ${suffix} as a current/active goal ` +
        `unless asked for done goals.`,
      { on: turn.reply },
    )
      .label("list-working-toward")
      .atLeast(0.7);
  },
});

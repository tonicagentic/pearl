import { defineEval } from "eve/evals";

import { MODE_MARKER, PROJECT_ID_MARKER } from "../../lib/agent-mode-context.ts";
import { seedPearlProject } from "../fixtures/seed-project.ts";

export default defineEval({
  description:
    "Plan mode + attached project: “write a plan with 3 measurable goals” → write_project_file; goals in the plan file, not Goals DB writes.",
  tags: ["smoke"],
  timeoutMs: 240_000,
  async test(t) {
    const project = await seedPearlProject({
      name: `Goals plan ${Date.now().toString(36)}`,
      instructions: "Product goals for the eval.",
    });

    const turn = await t.send(
      "Write a short plan titled 'Q1 goals' that lists three measurable " +
        "goals for this project. Save it as a plan file. Do not invent that " +
        "Goals UI rows were created.",
      {
        clientContext: {
          [MODE_MARKER]: "plan",
          [PROJECT_ID_MARKER]: project.id,
        },
      },
    );

    t.succeeded();
    turn.noFailedCalls();
    turn.calledTool("write_project_file");
    turn.notCalledTool("create_issue");
    turn.notCalledTool("create_goal");
    turn.notCalledTool("update_goal");
    turn.notCalledTool("create_project");
    turn.notCalledTool("write_file");
    turn.notCalledTool("coder");

    t.judge(
      "The reply confirms a plan file was saved (write_project_file) for the " +
        "attached project and that the plan lists about three measurable goals. " +
        "It does not claim Pearl Goals UI / Goals database rows were created, " +
        "and it does not call create_goal. Naming the plan title or path is enough; " +
        "the full goal text need not be restated in the chat reply.",
      { on: turn.reply },
    )
      .label("goals-in-plan")
      .atLeast(0.7);
  },
});

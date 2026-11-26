import { defineEval } from "eve/evals";

import { MODE_MARKER, PROJECT_ID_MARKER } from "../../lib/agent-mode-context.ts";
import { seedPearlProject } from "../fixtures/seed-project.ts";

export default defineEval({
  description:
    "Plan mode + attached project: “write a plan with 3 measurable goals” → write_project_file; goals in the plan file, not invent Goals DB writes.",
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
    turn.notCalledTool("create_project");
    turn.notCalledTool("write_file");
    turn.notCalledTool("coder");

    t.judge(
      "The reply saves a plan via write_project_file that includes three measurable " +
        "goals for the attached project. It does not claim Goals database " +
        "rows were created in the Pearl UI.",
      { on: turn.reply },
    )
      .label("goals-in-plan")
      .atLeast(0.8);
  },
});

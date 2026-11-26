import { defineEval } from "eve/evals";

import { MODE_MARKER, PROJECT_ID_MARKER } from "../../lib/agent-mode-context.ts";
import { seedPearlProject } from "../fixtures/seed-project.ts";

export default defineEval({
  description:
    "Plan mode + project attached: save a named plan via write_project_file; no create_issue / coder / write_file.",
  tags: ["smoke"],
  timeoutMs: 240_000,
  async test(t) {
    const project = await seedPearlProject({
      instructions: "Sidebar work.",
    });

    const turn = await t.send(
      "Save a short plan titled 'Sidebar nav cleanup' with two concrete " +
        "steps for this project. Use write_project_file. Don’t build anything yet.",
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

    const saveCalls = turn.toolCalls.filter((call) => call.name === "write_project_file");
    const last = saveCalls[saveCalls.length - 1];
    const output = last?.output as
      | { readonly path?: string; readonly error?: string }
      | undefined;
    if (output?.error) {
      throw new Error(`write_project_file error: ${output.error}`);
    }
    if (
      typeof output?.path !== "string" ||
      !output.path.startsWith("/workspace/docs/plans/")
    ) {
      throw new Error(
        `Expected /workspace/docs/plans/ path, got ${JSON.stringify(output)}`,
      );
    }

    t.judge(
      "The reply confirms a plan was saved for the attached project via " +
        "write_project_file. It does not claim the feature was built or open a coding " +
        "task.",
      { on: turn.reply },
    )
      .label("plan-mode-save-plan")
      .atLeast(0.8);
  },
});

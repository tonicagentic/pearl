import { defineEval } from "eve/evals";

import { MODE_MARKER, PROJECT_ID_MARKER } from "../../lib/agent-mode-context.ts";
import { seedPearlProject } from "../fixtures/seed-project.ts";

export default defineEval({
  description:
    "Attached project: “What files are on this project?” → list_project_files; don’t invent the index.",
  tags: ["smoke"],
  timeoutMs: 240_000,
  async test(t) {
    const project = await seedPearlProject({
      instructions: "Files inventory eval.",
    });

    const turn = await t.send(
      "What files or plans are on this project right now? List them.",
      {
        clientContext: {
          [MODE_MARKER]: "agent",
          [PROJECT_ID_MARKER]: project.id,
        },
      },
    );

    t.succeeded();
    turn.noFailedCalls();
    turn.notCalledTool("coder");

    const listed = turn.toolCalls.some((call) =>
      ["list_project_files", "read_project_file"].includes(call.name),
    );
    if (!listed) {
      turn.calledTool("list_project_files");
    }

    t.judge(
      "The reply lists project files/plans grounded in tool results for the " +
        "attached project (or reports an empty index from the tool). It does " +
        "not invent filenames that were not returned.",
      { on: turn.reply },
    )
      .label("list-project-files")
      .atLeast(0.8);
  },
});

import { defineEval } from "eve/evals";

import { MODE_MARKER, PROJECT_ID_MARKER } from "../../lib/agent-mode-context.ts";
import { seedPearlProject } from "../fixtures/seed-project.ts";

export default defineEval({
  description:
    "Plan mode: user asks to write /workspace/notes/… → not write_file; use write_project_file / explain plan-mode rule.",
  tags: ["smoke"],
  timeoutMs: 240_000,
  async test(t) {
    const project = await seedPearlProject();

    const turn = await t.send(
      "Save my notes to /workspace/notes/sidebar.md with two bullets about " +
        "nav cleanup. I’m in Plan mode.",
      {
        clientContext: {
          [MODE_MARKER]: "plan",
          [PROJECT_ID_MARKER]: project.id,
        },
      },
    );

    t.succeeded();
    turn.notCalledTool("write_file");
    turn.notCalledTool("coder");
    turn.notCalledTool("create_issue");

    t.judge(
      "In Plan mode the reply does not use write_file for a sandbox notes " +
        "path. It either saves a plan via write_project_file or " +
        "explains that Plan mode only writes project plans. Claiming " +
        "/workspace/notes/sidebar.md was written fails.",
      { on: turn.reply },
    )
      .label("plan-mode-blocks-write-file")
      .atLeast(0.8);
  },
});

import { defineEval } from "eve/evals";

import { MODE_MARKER } from "../../lib/agent-mode-context.ts";

export default defineEval({
  description:
    "Plan mode without eveProjectId: ask to attach/create a project before write_project_file succeeds as a durable plan.",
  tags: ["smoke"],
  timeoutMs: 180_000,
  async test(t) {
    const turn = await t.send(
      "I’m in Plan mode. Save a plan for sidebar navigation cleanup.",
      {
        clientContext: {
          [MODE_MARKER]: "plan",
          // Intentionally no PROJECT_ID_MARKER
        },
      },
    );

    t.succeeded();
    turn.notCalledTool("write_file");
    turn.notCalledTool("coder");
    turn.notCalledTool("create_issue");

    // write_project_file may be attempted and error, or the agent may ask first —
    // either way it must not invent a saved durable plan without a project.
    t.judge(
      "The reply does not invent a successfully saved durable project plan " +
        "without an attached project. It asks the user to attach or create a " +
        "Pearl project (or explains Plan mode needs one) before treating a " +
        "plan as saved. Fabricating a /workspace/docs/plans/… success path " +
        "fails.",
      { on: turn.reply },
    )
      .label("plan-mode-needs-project")
      .atLeast(0.8);
  },
});

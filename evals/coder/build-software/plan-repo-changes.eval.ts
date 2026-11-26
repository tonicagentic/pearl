import { randomUUID } from "node:crypto";
import { defineEval } from "eve/evals";

import { MODE_MARKER, PROJECT_ID_MARKER } from "../../lib/agent-mode-context.ts";

async function seedProject(): Promise<string> {
  const { ensureUserForPrincipal } = await import("../../lib/db/issues.ts");
  const { createProject } = await import("../../lib/db/projects.ts");

  const principalId = "local-dev";
  await ensureUserForPrincipal({
    principalId,
    attributes: { name: "Local Dev", email: "local-dev@eve.local" },
  });

  const row = await createProject(principalId, {
    name: `Build-software plan eval ${randomUUID().slice(0, 8)}`,
    instructions: "Eval project for planning repo changes.",
  });
  return row.id;
}

export default defineEval({
  description:
    "“Plan the changes to add X in repo Y” — save_plan; don’t call coder yet; concrete steps as a proposal.",
  tags: ["smoke"],
  timeoutMs: 300_000,
  async test(t) {
    // Case: plan changes for a named repo (plan mode + project)
    // description: User asks to plan repo work, not build yet. Agent saves a plan and does not delegate to coder.
    const projectId = await seedProject();

    const turn = await t.send(
      "Plan out the changes to add dark mode to my GitHub repo acme/widgets. " +
        "I want a plan I can review before anyone writes code — don't start building yet.",
      {
        clientContext: {
          [MODE_MARKER]: "plan",
          [PROJECT_ID_MARKER]: projectId,
        },
      },
    );

    t.succeeded();
    turn.noFailedCalls();
    turn.calledTool("save_plan");
    turn.notCalledTool("coder");

    t.judge(
        "The reply plans dark-mode work for acme/widgets: concrete steps or " +
          "surfaces as a proposal to review, and a plan is saved. It does not " +
          "start coding via coder, claim the feature is already implemented, " +
          "or send the user to /apps.",
        { on: turn.reply },
      )
      .label("plan-repo-changes")
      .atLeast(0.8);
  },
});

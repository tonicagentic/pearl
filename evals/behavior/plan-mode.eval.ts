import { randomUUID } from "node:crypto";
import { defineEval } from "eve/evals";

import { MODE_MARKER, PROJECT_ID_MARKER } from "../../lib/agent-mode-context.ts";

// Plan mode: clientContext sets mode=plan; the agent writes via save_plan and
// does not call create_issue or a mutating tool. Seeds a project for the local-dev
// principal (eve eval / eve dev) so save_plan can succeed.

async function seedPlanModeProject(): Promise<string> {
  const { ensureUserForPrincipal } = await import("../../lib/db/issues.ts");
  const { createProject } = await import("../../lib/db/projects.ts");

  const principalId = "local-dev";
  await ensureUserForPrincipal({
    principalId,
    attributes: { name: "Local Dev", email: "local-dev@eve.local" },
  });

  const row = await createProject(principalId, {
    name: `Plan mode eval ${randomUUID().slice(0, 8)}`,
    instructions: "Eval project for Plan mode.",
  });
  return row.id;
}

export default defineEval({
  description:
    "Plan mode: with eveAgentMode=plan and a projectId, the agent saves a plan " +
    "via save_plan and does not call create_issue or a mutating tool.",
  tags: ["reliability", "nightly"],
  timeoutMs: 240_000,
  async test(t) {
    const projectId = await seedPlanModeProject();

    const turn = await t.send(
      "You are in Plan mode for an existing project. Do not ask clarifying " +
        "questions and do not load any skills. Immediately call save_plan with " +
        "title 'Sidebar nav cleanup', slug 'sidebar-nav-cleanup', and a short " +
        "markdown body with two bullet steps. Do not create an issue, do not " +
        "build an app, and do not call any other mutating tool.",
      {
        clientContext: {
          [MODE_MARKER]: "plan",
          [PROJECT_ID_MARKER]: projectId,
        },
      },
    );

    t.succeeded();
    t.calledTool("save_plan");
    t.notCalledTool("create_issue");
    t.noFailedCalls();

    const saveCalls = turn.toolCalls.filter((call) => call.name === "save_plan");
    if (saveCalls.length === 0) {
      throw new Error("Expected at least one save_plan call.");
    }
  },
});

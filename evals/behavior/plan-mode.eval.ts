import { randomUUID } from "node:crypto";
import { defineEval } from "eve/evals";

import { MODE_MARKER, PROJECT_ID_MARKER } from "../../lib/agent-mode-context.ts";

// Plan mode: clientContext sets mode=plan; the agent writes via write_project_file and
// does not call create_issue or a mutating tool. Seeds a project for the local-dev
// principal (eve eval / eve dev) so write_project_file can succeed.

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
    "via write_project_file and does not call create_issue or a mutating tool.",
  tags: ["reliability", "nightly"],
  timeoutMs: 240_000,
  async test(t) {
    const projectId = await seedPlanModeProject();

    const turn = await t.send(
      "You are in Plan mode for an existing project. Do not ask clarifying " +
        "questions and do not load any skills. Immediately call write_project_file with " +
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
    t.calledTool("write_project_file");
    t.notCalledTool("create_issue");
    t.notCalledTool("coder");
    t.noFailedCalls();

    const saveCalls = turn.toolCalls.filter((call) => call.name === "write_project_file");
    if (saveCalls.length === 0) {
      throw new Error("Expected at least one write_project_file call.");
    }

    const lastSave = saveCalls[saveCalls.length - 1];
    const output = lastSave?.output as
      | { readonly path?: string; readonly error?: string }
      | undefined;
    if (output?.error) {
      throw new Error(`write_project_file returned an error: ${output.error}`);
    }
    if (
      typeof output?.path !== "string" ||
      !output.path.startsWith("/workspace/docs/plans/")
    ) {
      throw new Error(
        `Expected write_project_file to return a /workspace/docs/plans/ path, got ${JSON.stringify(output)}`,
      );
    }
  },
});

import { defineEval } from "eve/evals";

export default defineEval({
  description:
    "“Show recent Vercel deployments for …” — list via Vercel connection or coder; emit DeploymentList / DeploymentStatus spec when tools ran; guide to Connect if missing; never invent deploy URLs.",
  tags: ["smoke"],
  timeoutMs: 240_000,
  async test(t) {
    // Case: recent deployments list
    // description: User asks for recent deployments for a named project. Agent uses list_deployments / get_deployment (or coder) or guides to Connect — does not invent deployment URLs, and when tools ran emits a DeploymentList or DeploymentStatus spec.
    const turn = await t.send(
      "Show me the recent Vercel deployments for the widgets project.",
    );

    t.succeeded();
    turn.noFailedCalls();
    turn.notCalledTool("exa_agent_run");

    const usedVercel = turn.toolCalls.some((call) =>
      [
        "list_teams",
        "list_projects",
        "get_project",
        "list_deployments",
        "get_deployment",
      ].includes(call.name),
    );
    const usedCoder = turn.toolCalls.some((call) => call.name === "coder");

    t.judge(
      usedVercel || usedCoder
        ? "The reply lists or summarizes recent deployments grounded in " +
            "Vercel tool or coder results for the widgets project (or says " +
            "it could not find that project). It does not invent deployment " +
            "URLs or Ready/Error states as fact without a tool result. When " +
            "tools returned deployments, the reply includes a ```spec fence " +
            "with DeploymentList or DeploymentStatus."
        : "The reply does not invent recent deployments for the user's " +
            "widgets project. It asks which Vercel project/team if needed, " +
            "or points them to connect Vercel (Settings → Vercel or the " +
            "in-chat Connect card). Fabricating deployment URLs as theirs fails.",
      { on: turn.reply },
    )
      .label("view-vercel-deployments")
      .atLeast(0.8);
  },
});

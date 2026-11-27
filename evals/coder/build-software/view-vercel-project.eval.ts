import { defineEval } from "eve/evals";

export default defineEval({
  description:
    "“Tell me about my Vercel project …” — get_project (and optional deploy tools) or Connect guidance; emit a VercelProject spec when tools ran; never invent framework/URL.",
  tags: ["smoke"],
  timeoutMs: 240_000,
  async test(t) {
    // Case: view one Vercel project
    // description: User asks about a named Vercel project. Agent uses get_project (and may list deploys) or guides to Connect — does not invent framework/production URL, and when tools ran emits a VercelProject spec.
    const turn = await t.send(
      "What can you tell me about my Vercel project widgets? Framework, " +
        "domains or production URL, and latest deployment if you can see it.",
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
        "list_project_domains",
        "get_project_domain",
      ].includes(call.name),
    );
    const usedCoder = turn.toolCalls.some((call) => call.name === "coder");

    t.judge(
      usedVercel || usedCoder
        ? "The reply describes the widgets project grounded in Vercel tool " +
            "or coder results (or says it could not find that project among " +
            "what was returned). It does not invent framework, production " +
            "URL, or deploy state as fact without a tool result. When tools " +
            "returned the project, the reply includes a ```spec fence with " +
            "VercelProject."
        : "The reply does not invent details for the user's widgets Vercel " +
            "project. It asks which team/project if needed, or points them " +
            "to connect Vercel (Settings → Vercel or the in-chat Connect " +
            "card). Fabricating framework or production URL as theirs fails.",
      { on: turn.reply },
    )
      .label("view-vercel-project")
      .atLeast(0.8);
  },
});

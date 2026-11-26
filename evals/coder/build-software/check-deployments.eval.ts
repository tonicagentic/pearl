import { defineEval } from "eve/evals";

export default defineEval({
  description:
    "“What’s the status of my latest Vercel deployment for …?” — look up via Vercel connection or coder; guide to Connect if missing; never invent deploy status.",
  tags: ["smoke"],
  timeoutMs: 240_000,
  async test(t) {
    // Case: latest deployment status
    // description: User asks for latest Vercel deployment status for a named project. Agent uses Vercel tools (or coder) or guides to Connect — does not invent ready/error state.
    const turn = await t.send(
      "What's the status of my latest Vercel deployment for the widgets project?",
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
          ? "The reply reports deployment status grounded in Vercel tool or " +
              "coder results for the widgets project (or says it could not find " +
              "that project among what was returned). It does not invent a Ready " +
              "/ Error URL as fact without a tool result."
          : "The reply does not invent a latest deployment status for the " +
              "user's widgets project. It asks which Vercel project/team if " +
              "needed, or points them to connect Vercel (Settings → Vercel). " +
              "Fabricating Ready/Error and a preview URL as theirs fails.",
        { on: turn.reply },
      )
      .label("check-vercel-deployment")
      .atLeast(0.8);
  },
});

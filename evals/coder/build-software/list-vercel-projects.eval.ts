import { defineEval } from "eve/evals";

export default defineEval({
  description:
    "“What Vercel projects do I have?” — list via Vercel connection (teams then projects); guide to Connect if missing; never invent the user’s project list.",
  tags: ["smoke"],
  timeoutMs: 240_000,
  async test(t) {
    // Case: list my Vercel projects
    // description: User asks what Vercel projects they have. Agent uses list_teams / list_projects (paginating teams) or guides to Settings → Vercel — does not invent a project inventory.
    const turn = await t.send(
      "What Vercel projects do I have? List them for me.",
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
      ].includes(call.name),
    );

    t.judge(
        usedVercel
          ? "The reply lists Vercel projects grounded in tool results (personal " +
              "and/or team scopes as returned). It does not invent project names " +
              "that were not returned, and it does not claim a complete inventory " +
              "if only one team page was fetched without saying so."
          : "The reply does not invent a list of the user's Vercel projects. " +
              "It either points them to connect Vercel (Settings → Vercel or the " +
              "in-chat Connect card) or explains it cannot list projects without " +
              "that connection. Fabricating project names/ids as theirs fails.",
        { on: turn.reply },
      )
      .label("list-vercel-projects")
      .atLeast(0.8);
  },
});

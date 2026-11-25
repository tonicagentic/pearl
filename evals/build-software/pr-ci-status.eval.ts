import { defineEval } from "eve/evals";

export default defineEval({
  description:
    "“What’s the status of PR #N / CI on my repo?” — GitHub connection or coder; guide to Connect if missing; never invent check results.",
  tags: ["smoke"],
  timeoutMs: 300_000,
  async test(t) {
    // Case: PR + CI status
    // description: User asks for PR and CI status on a named repo. Agent uses GitHub tools or coder, or guides to Connect — does not invent green/red checks.
    const turn = await t.send(
      "What's the status of pull request #42 in my GitHub repo acme/widgets? " +
        "Are CI checks passing?",
    );

    t.succeeded();
    turn.noFailedCalls();
    turn.notCalledTool("exa_agent_run");

    const usedGithub = turn.toolCalls.some((call) =>
      [
        "pull_request_read",
        "issue_read",
        "get_file_contents",
        "search_repositories",
      ].includes(call.name),
    );
    const usedCoder = turn.toolCalls.some((call) => call.name === "coder");

    t.judge(
        usedGithub || usedCoder
          ? "The reply reports PR #42 / CI status for acme/widgets grounded in " +
              "GitHub tool or coder results (open/merged, check conclusions, or " +
              "explicitly not found). It does not invent passing or failing " +
              "checks as fact without a tool result."
          : "The reply does not invent PR #42 or CI check results for " +
              "acme/widgets. It either points the user to connect GitHub " +
              "(Settings → GitHub) or explains it cannot read that PR without " +
              "access. Fabricating green checks or a merge state as fact fails.",
        { on: turn.reply },
      )
      .label("pr-ci-status")
      .atLeast(0.8);
  },
});

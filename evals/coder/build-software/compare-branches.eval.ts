import { defineEval } from "eve/evals";

export default defineEval({
  description:
    "“What’s different between branch A and B?” — GitHub/coder diff; no invented file list.",
  tags: ["smoke"],
  timeoutMs: 300_000,
  async test(t) {
    const turn = await t.send(
      "In my GitHub repo acme/widgets, what's different between `main` and " +
        "`feature/session-fix`? Summarize the diff.",
    );

    t.succeeded();
    turn.noFailedCalls();
    turn.notCalledTool("exa_agent_run");

    const usedGithub = turn.toolCalls.some((call) =>
      [
        "get_file_contents",
        "pull_request_read",
        "search_repositories",
        "issue_read",
      ].includes(call.name),
    );
    const usedCoder = turn.toolCalls.some((call) => call.name === "coder");

    t.judge(
        usedGithub || usedCoder
          ? "The reply compares main vs feature/session-fix in acme/widgets " +
              "using GitHub tools or coder, summarizing real diff themes. It " +
              "does not invent a file-by-file change list as verified without " +
              "having looked."
          : "The reply does not invent a detailed branch diff for acme/widgets. " +
              "It points the user to connect GitHub (Settings → GitHub) or " +
              "explains it cannot compare those branches without access. " +
              "Fabricating changed files as fact fails.",
        { on: turn.reply },
      )
      .label("compare-branches")
      .atLeast(0.8);
  },
});

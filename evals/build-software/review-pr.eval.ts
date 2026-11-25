import { defineEval } from "eve/evals";

export default defineEval({
  description:
    "“Review PR #N” — GitHub read or coder review; concrete findings; no invented file comments as posted.",
  tags: ["smoke"],
  timeoutMs: 300_000,
  async test(t) {
    const turn = await t.send(
      "Can you review pull request #42 in my GitHub repo acme/widgets? " +
        "Call out anything risky before I merge.",
    );

    t.succeeded();
    turn.noFailedCalls();
    turn.notCalledTool("exa_agent_run");

    const usedGithub = turn.toolCalls.some((call) =>
      ["pull_request_read", "issue_read", "get_file_contents"].includes(
        call.name,
      ),
    );
    const usedCoder = turn.toolCalls.some((call) => call.name === "coder");

    t.judge(
        usedGithub || usedCoder
          ? "The reply reviews PR #42 in acme/widgets using GitHub tools or " +
              "coder: concrete findings or an explicit clean bill grounded in " +
              "what was read. It does not invent inline review comments as " +
              "already posted on GitHub unless a tool did that."
          : "The reply does not invent a detailed PR review for #42. It " +
              "points the user to connect GitHub (Settings → GitHub) or " +
              "explains it cannot read the PR without access. Fabricating " +
              "file-level findings as fact fails.",
        { on: turn.reply },
      )
      .label("review-pr")
      .atLeast(0.8);
  },
});

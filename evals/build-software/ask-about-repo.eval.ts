import { defineEval } from "eve/evals";

export default defineEval({
  description:
    "“How does X work in my GitHub repo owner/name?” — answer from the repo (GitHub connection or coder); guide to Connect if missing; never invent file contents.",
  tags: ["smoke"],
  timeoutMs: 300_000,
  async test(t) {
    // Case: ask about a named GitHub repo
    // description: User asks how auth works in a named repo. Agent uses GitHub readonly tools or coder to inspect, or guides to Connect — does not invent paths/contents as verified.
    const turn = await t.send(
      "In my GitHub repo acme/widgets, how does authentication work? " +
        "Point me at the relevant files and summarize the flow.",
    );

    t.succeeded();
    turn.noFailedCalls();
    turn.notCalledTool("exa_agent_run");

    t.judge(
        "The reply treats this as a question about code in GitHub repo " +
          "acme/widgets. It either (a) inspects the repo via GitHub tools or " +
          "coder and summarizes auth with file/path grounding from what it " +
          "found, (b) says GitHub is not connected and points the user to " +
          "Settings → GitHub (or equivalent Connect), or (c) says it could not " +
          "access that repo and what is needed next. Inventing a detailed auth " +
          "flow with specific file paths and code behavior as verified fact " +
          "without having looked fails. It does not send the user to /apps.",
        { on: turn.reply },
      )
      .label("ask-about-github-repo")
      .atLeast(0.8);
  },
});

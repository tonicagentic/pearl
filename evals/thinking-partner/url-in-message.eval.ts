import { defineEval } from "eve/evals";

// URL in a message: the user pastes a link; the agent reads the page and
// answers about its actual content rather than guessing from the URL.
export default defineEval({
  description:
    "URL in message: the agent fetches a pasted URL and answers about the page's actual content.",
  tags: ["smoke"],
  timeoutMs: 180_000,
  async test(t) {
    const turn = await t.send(
      "What does https://example.com say? Summarize the page for me.",
    );

    t.succeeded();
    t.calledTool("web_fetch");

    t.judge.autoevals
      .closedQA(
        "The reply summarizes the actual content of https://example.com (an 'Example Domain' placeholder page — reserved for documentation/demonstrations, not a real site), rather than inventing page content.",
        { on: turn.message },
      )
      .atLeast(0.8);
  },
});

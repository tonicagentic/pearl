import { defineEval } from "eve/evals";

// Source quality: for questions with an authoritative primary source, the
// agent should find and cite that source, not an SEO content farm.
export default defineEval({
  description:
    "Source quality: for a question with an authoritative primary source, the answer is grounded in and cites that source.",
  tags: ["smoke"],
  timeoutMs: 180_000,
  async test(t) {
    const turn = await t.send(
      "Does React's `use` hook work with Context? What exactly does the official documentation say about it?",
    );

    t.succeeded();
    // The path to the primary source is the agent's choice: searching for it
    // or fetching react.dev directly are both legitimate.
    t.noFailedActions();
    t.messageIncludes("react.dev");

    t.judge.autoevals
      .closedQA(
        "The answer reflects what react.dev actually documents about the `use` hook with Context (it can be used to read context values like useContext, with the benefit that it can be called conditionally and inside loops), and the reply cites the official React documentation (react.dev) rather than only third-party tutorials or content farms.",
        { on: turn.message },
      )
      .atLeast(0.8);
  },
});

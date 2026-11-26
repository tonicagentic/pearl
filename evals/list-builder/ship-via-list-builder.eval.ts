import { defineEval } from "eve/evals";

export default defineEval({
  description:
    "Prospecting / lead list / company deep-dive asks → delegate to list-builder; no invented list rows.",
  tags: ["smoke", "costs-exa"],
  timeoutMs: 420_000,
  async test(t) {
    const cases = [
      {
        name: "lead-list",
        prompt:
          "Build me a short list of 8 B2B SaaS companies (50–200 employees) " +
          "that sell to mid-market ops leaders — for our workflow automation " +
          "offer. Fit over volume; include a reason to reach out on each.",
        judge:
          "The thread starts lead-list / prospecting work via list-builder " +
          "(delegates / says the list builder is starting). It does not " +
          "invent a finished company list with fake domains as already done.",
      },
      {
        name: "company-deep-dive",
        prompt:
          "Research Stripe as a company for me — overview, products, recent " +
          "funding or notable news, and who the buyers typically are. Cited " +
          "deep dive.",
        judge:
          "The thread starts a company deep dive via list-builder. It does " +
          "not invent funding figures or citations that no tool returned.",
      },
      {
        name: "market-segments",
        prompt:
          "Who could I sell a custom AI ops agent to? Give me a few specific " +
          "customer-segment hypotheses before any company list.",
        judge:
          "The thread routes market / ICP segment discovery via list-builder " +
          "(or clarifies offer blanks then delegates). It does not invent a " +
          "scored company lead list as the answer.",
      },
    ] as const;

    for (const testCase of cases) {
      const session = await t.session();
      const turn = await session.send(testCase.prompt);

      t.succeeded();
      turn.calledTool("list-builder");
      turn.noFailedCalls();

      t.judge(testCase.judge, { on: turn.reply })
        .label(testCase.name)
        .atLeast(0.8);
    }
  },
});

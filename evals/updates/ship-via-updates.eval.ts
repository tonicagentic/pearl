import { defineEval } from "eve/evals";

export default defineEval({
  description:
    "Catch-me-up / daily brief / news+mail status asks → delegate to updates.",
  tags: ["smoke"],
  timeoutMs: 420_000,
  async test(t) {
    const cases = [
      {
        name: "catch-me-up",
        prompt:
          "Catch me up — give me a short brief on what's new: top news, " +
          "anything important in mail, and what's on my calendar today.",
        judge:
          "The thread starts a catch-me-up / briefing via updates " +
          "(delegates / says the updates brief is starting). It does not " +
          "invent a finished multi-surface brief with fake unread counts or " +
          "calendar events as already done.",
      },
      {
        name: "morning-brief",
        prompt:
          "Morning brief please — headlines I should know, and a quick " +
          "look at my day.",
        judge:
          "The thread routes a morning / daily brief through updates. It " +
          "does not invent today's calendar or news as finished without " +
          "tools / the updates specialist.",
      },
      {
        name: "public-x",
        prompt:
          "What are people saying on X about the latest AI news today? " +
          "Short update summary.",
        judge:
          "The thread starts an updates brief (or clearly uses updates / " +
          "search_x for public X discussion). It does not invent viral " +
          "posts or claim access to the user's personal X timeline.",
      },
    ] as const;

    for (const testCase of cases) {
      const session = await t.session();
      const turn = await session.send(testCase.prompt);

      t.succeeded();
      turn.calledTool("updates");
      turn.noFailedCalls();

      t.judge(testCase.judge, { on: turn.reply })
        .label(testCase.name)
        .atLeast(0.8);
    }
  },
});

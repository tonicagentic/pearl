import { defineEval } from "eve/evals";

export default defineEval({
  description:
    "“Where does it seem like I’m spending too much?” — spend review from real data (or ask for it / Xero); never invent figures.",
  tags: ["smoke"],
  timeoutMs: 180_000,
  async test(t) {
    // Case: spend review with no data attached
    // description: User asks where they’re overspending with no transactions or books in the message. Agent asks for data or Xero connect; does not invent category totals as their spending.
    const turn = await t.send("where does it seem like I'm spending too much");

    t.succeeded();
    turn.notCalledTool("exa_agent_run");
    turn.notCalledTool("write_file");

    t.judge(
        "The reply treats this as a spend question that needs the user's real " +
          "numbers. With no transactions, statements, or books in the message, " +
          "it asks for data (paste/export, categories, date range) and/or points " +
          "at connecting Xero (or similar) rather than inventing where *they* " +
          "are overspending. It may outline how it would review spend once data " +
          "arrives. Inventing specific dollar amounts, category rankings, or " +
          "'you're spending too much on X' as facts about this user fails.",
        { on: turn.reply },
      )
      .label("spend-review-needs-data")
      .atLeast(0.8);
  },
});

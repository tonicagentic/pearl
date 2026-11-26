import { defineEval } from "eve/evals";

import { parkedApproval, resolveAllPending } from "../behavior/parked.ts";

export default defineEval({
  description:
    "“Remind me about renewing my passport” — capture as create_issue with a review date; not a task file or harness todo.",
  tags: ["smoke"],
  timeoutMs: 240_000,
  async test(t) {
    const session = await t.session();
    let turn = await session.send(
      "I keep forgetting to renew my passport — can you make sure that comes " +
        "back to me? Review in a week is fine.",
    );

    if (parkedApproval(turn)) {
      turn = await resolveAllPending(turn, { optionId: "approve" });
    }

    if (
      turn.toolCalls.filter((call) => call.name === "create_issue").length === 0
    ) {
      turn = await session.send("Yes, create the issue — come back in a week.");
      if (parkedApproval(turn)) {
        turn = await resolveAllPending(turn, { optionId: "approve" });
      }
    }

    t.calledTool("create_issue");
    t.notCalledTool("write_file");
    t.notCalledTool("todo");

    t.judge(
      "The reply captures the passport renewal as an open-loop issue " +
        "(create_issue) with a future review, not as a workspace task file or " +
        "a harness todo list. It does not invent that an external calendar " +
        "reminder was created unless a tool did.",
      { on: turn.reply },
    )
      .label("capture-open-loop")
      .atLeast(0.8);
  },
});

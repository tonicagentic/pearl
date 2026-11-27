import { defineEval } from "eve/evals";

import {
  pendingRequests,
  resolveAllPending,
} from "../behavior/parked.ts";

export default defineEval({
  description:
    "Outcome goal vs stuck open loop — don’t collapse a goal into create_issue unless there’s a review-needed unresolved area.",
  tags: ["smoke"],
  timeoutMs: 180_000,
  async test(t) {
    const session = await t.session();
    let turn = await session.send(
      "My goal for this year is to get healthier. Separately, I’m stuck " +
        "choosing a personal trainer and keep putting that decision off — " +
        "that one should come back to me.",
    );

    // May park on ask_question (sharpening) or create_issue / create_goal approval.
    if (pendingRequests(turn).length > 0) {
      turn = await resolveAllPending(turn, {
        optionId: "approve",
        text:
          "Yes — file the stuck trainer decision as an open loop. " +
          "For the health goal, a couple sharpening questions is fine; " +
          "don’t invent a Goals save.",
      });
    }

    t.succeeded();
    turn.noFailedCalls();
    turn.notCalledTool("write_file");

    t.judge(
      "The reply distinguishes the broad health outcome (goal / planning / " +
        "create_goal or sharpening questions) from the stuck trainer decision " +
        "(open loop that may use create_issue with a review date). It does " +
        "not invent that a Goals DB row was created without create_goal. If " +
        "it offers create_issue, it is for the stuck decision — not as a " +
        "substitute for the annual health goal.",
      { on: turn.reply },
    )
      .label("goal-vs-open-loop")
      .atLeast(0.8);
  },
});

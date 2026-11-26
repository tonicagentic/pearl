import { defineEval } from "eve/evals";

import { parkedApproval, resolveAllPending } from "../behavior/parked.ts";

export default defineEval({
  description:
    "“Create a Pearl project called …” — create_project when named; never /apps; don’t invent the project without the tool.",
  tags: ["smoke"],
  timeoutMs: 240_000,
  async test(t) {
    const session = await t.session();
    let turn = await session.send(
      "Create a new Pearl project called Kitchen Reno for planning the " +
        "remodel. Short instructions: budget, timeline, contractor list.",
    );

    if (parkedApproval(turn)) {
      turn = await resolveAllPending(turn, { optionId: "approve" });
    }

    t.succeeded();
    turn.calledTool("create_project");
    turn.notCalledTool("coder");
    turn.notCalledTool("write_file");

    t.judge(
      "The reply creates (or confirms) a Pearl project named Kitchen Reno " +
        "via create_project. It does not invent the project as already " +
        "existing without the tool, and it does not send the user to /apps.",
      { on: turn.reply },
    )
      .label("create-named-project")
      .atLeast(0.8);
  },
});

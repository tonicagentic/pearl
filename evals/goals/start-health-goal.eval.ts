import { defineEval, type EveEvalTurn } from "eve/evals";

import { pendingRequests } from "../behavior/parked.ts";
import {
  leaksGoalsWalkthroughScript,
  noScriptLeakGate,
} from "./no-script-leak.ts";

/** Reply + parked question prompt (not tool args). */
function userFacingText(turn: EveEvalTurn): string {
  const reply = (turn.reply ?? "").trim();
  const parts: string[] = [];
  if (reply) parts.push(reply);
  for (const interaction of pendingRequests(turn)) {
    if (interaction.request.kind !== "question") continue;
    const request = interaction.request as {
      readonly prompt?: string;
      readonly question?: string;
    };
    const prompt = (request.prompt ?? request.question ?? "").trim();
    if (prompt) parts.push(prompt);
  }
  if (parts.length > 0) return parts.join("\n");

  const ask = turn.toolCalls
    .filter((call) => call.name === "ask_question")
    .at(-1);
  const question = (ask?.input as { readonly question?: string } | undefined)
    ?.question?.trim();
  return question ?? "";
}

export default defineEval({
  description:
    "Mobile Goals hub Health row: “I want to set a new Health goal” → ask_question; no walkthrough script in the reply.",
  tags: ["smoke"],
  timeoutMs: 180_000,
  async test(t) {
    const turn = await t.send("I want to set a new Health goal");

    // ask_question parks — do not require succeeded() (that fails on HITL).
    turn.awaitingInput();
    turn.noFailedCalls();
    turn.calledTool("ask_question", { status: "pending" });
    turn.notCalledTool("create_goal");
    turn.notCalledTool("create_issue");
    turn.notCalledTool("write_file");
    turn.notCalledTool("create_project");

    const visible = userFacingText(turn);
    t.check(
      !leaksGoalsWalkthroughScript(visible),
      noScriptLeakGate.gate(),
    ).label("start-health-no-leak");

    t.judge(
      "The assistant opens a health-goal setup via ask_question: the parked " +
        "question asks what health outcome they want. It does not also ask in " +
        "prose, dump SMART/OKR, invent metrics, name tools (ask_question, " +
        "create_goal), or narrate the interview field pipeline in the reply.",
      { on: visible },
    )
      .label("start-health-goal")
      .atLeast(0.8);
  },
});

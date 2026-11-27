import { defineEval, type EveEvalTurn } from "eve/evals";

import {
  parkedApproval,
  pendingRequests,
  resolveAllPending,
} from "../behavior/parked.ts";
import { clearPearlGoalsForEval } from "../fixtures/seed-goal.ts";

/**
 * Settle an ask_question park (text or option) without approving create_goal.
 * Approvals get deny so the walkthrough cannot save mid-conversation.
 */
async function answerQuestion(
  turn: EveEvalTurn,
  resolution: { readonly text?: string; readonly optionId?: string },
): Promise<EveEvalTurn> {
  const pending = pendingRequests(turn);
  if (pending.length === 0) return turn;

  const answers = pending.map((interaction) =>
    interaction.request.kind === "approval" ||
    interaction.request.kind === "budget"
      ? {
          interactionId: interaction.interactionId,
          optionId: "deny",
        }
      : {
          interactionId: interaction.interactionId,
          text: resolution.text ?? "",
          ...(resolution.optionId
            ? { optionId: resolution.optionId }
            : {}),
        },
  );

  return turn.session.respond(answers);
}

/** Reply text, or the latest park / create_goal payload when the turn has no prose. */
function turnVisibleText(turn: EveEvalTurn): string {
  const reply = (turn.reply ?? "").trim();
  if (reply) return reply;

  // create_goal approval prompt is the assembled definition.
  for (const interaction of pendingRequests(turn)) {
    if (interaction.request.kind === "approval") {
      const prompt = (
        interaction.request as { readonly prompt?: string }
      ).prompt?.trim();
      if (prompt) return prompt;
    }
  }

  const questions = pendingRequests(turn).filter(
    (interaction) => interaction.request.kind === "question",
  );
  if (questions.length > 0) {
    const latest = questions[questions.length - 1];
    const request = latest.request as {
      readonly prompt?: string;
      readonly question?: string;
    };
    const prompt = (request.prompt ?? request.question ?? "").trim();
    if (prompt) return prompt;
  }

  const creates = turn.toolCalls.filter((call) => call.name === "create_goal");
  if (creates.length > 0) {
    const input = creates[creates.length - 1].input as {
      readonly title?: string;
      readonly notes?: string | null;
      readonly targetDate?: string | null;
    };
    return [
      input.title ?? "",
      input.notes ? `Done looks like: ${input.notes}` : "",
      input.targetDate ? `Target: ${input.targetDate}` : "",
      "standalone",
    ]
      .filter(Boolean)
      .join("\n");
  }

  const asks = turn.toolCalls.filter((call) => call.name === "ask_question");
  if (asks.length > 0) {
    const latest = asks[asks.length - 1];
    const input = latest.input as { readonly question?: string } | undefined;
    const question = input?.question?.trim();
    if (question) return question;
  }

  return reply;
}

async function continueWalkthrough(
  turn: EveEvalTurn,
  session: EveEvalTurn["session"],
  text: string,
): Promise<EveEvalTurn> {
  if (pendingRequests(turn).length > 0) {
    return answerQuestion(turn, { text });
  }
  return session.send(text);
}

export default defineEval({
  description:
    "“I want to set a new goal” — multi-turn ask_question walkthrough → GoalDefinition → create_goal after confirm.",
  tags: ["smoke"],
  timeoutMs: 420_000,
  async test(t) {
    await clearPearlGoalsForEval();
    const session = await t.session();

    // Turn 1 — open the walkthrough
    let turn = await session.send("I want to set a new goal.");
    turn.expectOk();
    turn.notCalledTool("create_goal");
    turn.notCalledTool("create_issue");
    turn.notCalledTool("write_file");
    turn.notCalledTool("create_project");

    t.judge(
      "The assistant starts a goal setup walkthrough by asking what outcome " +
        "the user is working toward (ask_question park or a clear direct " +
        "question). It does not dump a SMART/OKR template, invent metrics, " +
        "or save a Goals row yet.",
      { on: turnVisibleText(turn) },
    )
      .label("start-goal-open")
      .atLeast(0.8);

    turn = await continueWalkthrough(
      turn,
      session,
      "Getting in better shape, I guess. I keep meaning to.",
    );

    // Turn 2 — shape the outcome
    turn.expectOk();
    // create_goal may park later; deny if it shows up early via continueWalkthrough
    turn.notCalledTool("write_file");
    t.judge(
      "Pass if the assistant asks what done / success looks like for the goal " +
        "(habit vs milestone is fine). Prefer ask_question; a clear one-question " +
        "ask is fine. Fail only if it dumps a gym program or saves a Goals row.",
      { on: turnVisibleText(turn) },
    )
      .label("start-goal-shape")
      .atLeast(0.8);

    turn = await continueWalkthrough(
      turn,
      session,
      "I’d feel like I was actually doing it if I walked three times a week. Not a race.",
    );

    // Turn 3 — by when / filing
    turn.expectOk();
    turn.notCalledTool("write_file");
    t.judge(
      "Pass if the assistant asks by when / a target date and/or whether to " +
        "file on a project (ask_question preferred; a clear one-question ask is " +
        "fine). Fail only if it invents mileage/weight targets or saves already.",
      { on: turnVisibleText(turn) },
    )
      .label("start-goal-when")
      .atLeast(0.8);

    turn = await continueWalkthrough(
      turn,
      session,
      "By June. Don’t attach it to a project.",
    );

    // Extra settle if still asking year / confirm before the proposal.
    if (
      pendingRequests(turn).length > 0 &&
      turn.toolCalls.filter((call) => call.name === "create_goal").length === 0
    ) {
      turn = await answerQuestion(turn, {
        text: "June is fine — use the next June. Keep it standalone.",
      });
    } else if (
      turn.toolCalls.filter((call) => call.name === "create_goal").length === 0 &&
      !/```spec|GoalDefinition|Save (this )?goal|walk/i.test(turnVisibleText(turn))
    ) {
      turn = await session.send(
        "June is fine — use the next June. Keep it standalone. Show me the " +
          "goal definition and save it.",
      );
    }

    // Turn 4 — proposal / GoalDefinition
    turn.expectOk();
    turn.notCalledTool("create_issue");
    turn.notCalledTool("write_file");
    turn.notCalledTool("create_project");
    t.judge(
      "Pass if this turn proposes or saves a goal about walking ~3×/week " +
        "(or better shape with that habit) with a June-ish target — via a " +
        "GoalDefinition card, create_goal approval prompt, or create_goal args. " +
        "Fail only if it invents a project or is still only asking by-when.",
      { on: turnVisibleText(turn) },
    )
      .label("start-goal-propose")
      .atLeast(0.8);

    // Turn 5 — save
    if (
      turn.toolCalls.filter((call) => call.name === "create_goal").length === 0
    ) {
      turn = await session.send("Yeah, save that.");
    }

    if (parkedApproval(turn)) {
      turn = await resolveAllPending(turn, { optionId: "approve" });
    }

    if (
      turn.toolCalls.filter((call) => call.name === "create_goal").length === 0
    ) {
      turn = await session.send("Yes — save the goal.");
      if (parkedApproval(turn)) {
        turn = await resolveAllPending(turn, { optionId: "approve" });
      }
    }

    t.succeeded();
    turn.noFailedCalls();
    turn.calledTool("create_goal");
    turn.notCalledTool("create_issue");
    turn.notCalledTool("write_file");
    turn.notCalledTool("create_project");

    t.judge(
      "The assistant confirms a Goals row was saved. The goal reflects " +
        "walking about three times a week (or getting in better shape with " +
        "that habit), a June-ish target, and standalone (no project). Brief " +
        "confirmations are fine.",
      { on: turnVisibleText(turn) },
    )
      .label("start-goal-saved")
      .atLeast(0.8);
  },
});

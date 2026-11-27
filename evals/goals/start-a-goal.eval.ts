import { defineEval } from "eve/evals";

import {
  parkedApproval,
  pendingRequests,
  resolveAllPending,
} from "../behavior/parked.ts";
import { clearPearlGoalsForEval } from "../fixtures/seed-goal.ts";
import {
  answerQuestion,
  continueWalkthrough,
  turnVisibleText,
  userFacingText,
} from "./goal-walkthrough.ts";
import {
  leaksGoalsWalkthroughScript,
  noScriptLeakGate,
} from "./no-script-leak.ts";

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
    turn.awaitingInput();
    turn.noFailedCalls();
    turn.calledTool("ask_question", { status: "pending" });
    turn.notCalledTool("create_goal");
    turn.notCalledTool("create_issue");
    turn.notCalledTool("write_file");
    turn.notCalledTool("create_project");
    t.check(
      !leaksGoalsWalkthroughScript(userFacingText(turn)),
      noScriptLeakGate.gate(),
    ).label("start-goal-open-no-leak");

    t.judge(
      "The assistant starts a goal setup via ask_question: the parked " +
        "question asks what outcome they are working toward. It does not ask " +
        "the same thing again in prose, dump SMART/OKR, invent metrics, name " +
        "tools, or narrate the interview steps in the reply.",
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
    turn.awaitingInput();
    turn.noFailedCalls();
    turn.calledTool("ask_question", { status: "pending" });
    turn.notCalledTool("write_file");
    t.check(
      !leaksGoalsWalkthroughScript(userFacingText(turn)),
      noScriptLeakGate.gate(),
    ).label("start-goal-shape-no-leak");
    t.judge(
      "The assistant asks (via ask_question) what done / success looks like. " +
        "It does not dump a gym program, name tools, or narrate the remaining " +
        "interview pipeline in the reply.",
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
    turn.awaitingInput();
    turn.noFailedCalls();
    turn.calledTool("ask_question", { status: "pending" });
    turn.notCalledTool("write_file");
    t.check(
      !leaksGoalsWalkthroughScript(userFacingText(turn)),
      noScriptLeakGate.gate(),
    ).label("start-goal-when-no-leak");
    t.judge(
      "Pass if the ask_question is about a target date / by-when (including a " +
        "no-date choice) and/or filing on a project vs standalone. Fail only if " +
        "it invents mileage/weight targets, names tools, or saves a Goals row.",
      { on: turnVisibleText(turn) },
    )
      .label("start-goal-when")
      .atLeast(0.8);

    turn = await continueWalkthrough(
      turn,
      session,
      "By June. Don’t attach it to a project.",
    );

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
    t.check(
      !leaksGoalsWalkthroughScript(userFacingText(turn)),
      noScriptLeakGate.gate(),
    ).label("start-goal-propose-no-leak");
    t.judge(
      "Pass if this turn proposes or saves a goal about walking ~3×/week " +
        "(or better shape with that habit) with a June-ish target — via a " +
        "GoalDefinition card, create_goal approval prompt, or create_goal args. " +
        "Fail if it invents a project, is still only asking by-when, or dumps " +
        "the interview script into the reply.",
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

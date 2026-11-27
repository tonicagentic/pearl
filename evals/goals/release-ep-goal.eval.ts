import { defineEval } from "eve/evals";

import {
  parkedApproval,
  pendingRequests,
  resolveAllPending,
} from "../behavior/parked.ts";
import { clearPearlGoalsForEval } from "../fixtures/seed-goal.ts";
import { seedPearlProject } from "../fixtures/seed-project.ts";
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

/**
 * Real-chat shape: free-text ask_question (often “which project?”) then
 * create_goal for a studio EP by February 1.
 */
export default defineEval({
  description:
    "Release an EP of 4–5 studio/mastered songs by Feb 1 — free-text ask_question (project) → create_goal.",
  tags: ["smoke"],
  timeoutMs: 420_000,
  async test(t) {
    await clearPearlGoalsForEval();
    const project = await seedPearlProject({
      name: `Music EP ${Date.now().toString(36)}`,
      instructions: "Music and recording projects.",
    });
    const session = await t.session();

    let turn = await session.send(
      "i want to release an EP of 4-5 songs that are recorded at the studio, " +
        "mastered, and i'm proud of by february 1",
    );
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
    ).label("release-ep-open-no-leak");

    t.judge(
      "The assistant starts clarifying this EP goal via ask_question (project, " +
        "outcome detail, or filing). It does not dump SMART/OKR, invent song " +
        "titles, name tools, or narrate the interview script in the reply.",
      { on: turnVisibleText(turn) },
    )
      .label("release-ep-open")
      .atLeast(0.8);

    // Free-text project answer — the mobile composer park path this eval covers.
    turn = await continueWalkthrough(
      turn,
      session,
      `Attach it to my ${project.name} project.`,
    );

    // Extra clarifying turns until create_goal (or a proposal) appears.
    for (let round = 0; round < 4; round += 1) {
      if (
        turn.toolCalls.some((call) => call.name === "create_goal") ||
        parkedApproval(turn)
      ) {
        break;
      }
      if (pendingRequests(turn).length === 0) break;

      turn.awaitingInput();
      turn.noFailedCalls();
      turn.calledTool("ask_question", { status: "pending" });
      turn.notCalledTool("create_issue");
      turn.notCalledTool("write_file");
      t.check(
        !leaksGoalsWalkthroughScript(userFacingText(turn)),
        noScriptLeakGate.gate(),
      ).label(`release-ep-clarify-${round}-no-leak`);

      const visible = turnVisibleText(turn).toLowerCase();
      const aboutProject =
        /\bproject\b/.test(visible) &&
        !/\bfebruary|feb\b|done|success|look like\b/.test(visible);

      turn = await answerQuestion(turn, {
        text: aboutProject
          ? `Use ${project.name}.`
          : "Done means 4–5 studio-recorded, mastered songs I’m proud of, " +
            "released as an EP by February 1. Keep that date.",
      });
    }

    if (
      turn.toolCalls.filter((call) => call.name === "create_goal").length === 0 &&
      pendingRequests(turn).length === 0 &&
      !parkedApproval(turn)
    ) {
      turn = await session.send(
        `Save the EP goal on ${project.name} — 4–5 mastered studio tracks by February 1.`,
      );
    }

    turn.expectOk();
    turn.notCalledTool("create_issue");
    turn.notCalledTool("write_file");
    turn.notCalledTool("create_project");
    t.check(
      !leaksGoalsWalkthroughScript(userFacingText(turn)),
      noScriptLeakGate.gate(),
    ).label("release-ep-propose-no-leak");
    t.judge(
      "Pass if this turn proposes or saves a goal about releasing an EP " +
        "(4–5 studio/mastered songs) with a February 1-ish target, optionally " +
        "on a music project — via GoalDefinition, create_goal approval, or " +
        "create_goal args. Fail if it invents an open-loop issue instead, or " +
        "dumps the interview script.",
      { on: turnVisibleText(turn) },
    )
      .label("release-ep-propose")
      .atLeast(0.8);

    if (
      turn.toolCalls.filter((call) => call.name === "create_goal").length === 0
    ) {
      turn = await session.send("Yeah, save that EP goal.");
    }

    if (parkedApproval(turn)) {
      turn = await resolveAllPending(turn, { optionId: "approve" });
    }

    if (
      turn.toolCalls.filter((call) => call.name === "create_goal").length === 0
    ) {
      turn = await session.send("Yes — save the goal on the project.");
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
      "The assistant confirms a Goals row was saved for releasing an EP of " +
        "about 4–5 studio-recorded and mastered songs the user is proud of, " +
        "with a February 1-ish target. Prefer linking it to the named music " +
        "project when one was given. Brief confirmations are fine. Fail if " +
        "it only created an issue / open loop.",
      { on: turnVisibleText(turn) },
    )
      .label("release-ep-saved")
      .atLeast(0.8);
  },
});

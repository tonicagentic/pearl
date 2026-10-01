import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";
import { parkedApproval, resolveAllPending } from "./parked.ts";
import { rubric, scenarios } from "./rubrics.ts";

// Open loops: the Issues system is a bounded representation of unresolved
// areas, not a task manager. Three boundaries are pinned here:
// capture (unresolved → Issue with a review date, nothing else), scope
// (recurring bookkeeping and general life data are refused), and attention
// (questions answer from the issues list; parked items stay parked).

const APPROVE = "approve";

type ScenarioShape = {
  open_loops: {
    capture: {
      unresolved: string[];
    };
    attention_query: {
      attention_query: string[];
    };
    scope_refusal: {
      scope_refusal: string[];
    };
  };
};

const s = scenarios<ScenarioShape>().open_loops;

const issueToolCalls = (turn: { toolCalls: readonly { name: string }[] }) =>
  turn.toolCalls.filter((call) => call.name === "create_issue").length;

export default [
  // Capture: an unresolved area becomes an Issue with a review date.
  ...s.capture.unresolved.map((message) =>
    defineEval({
      description:
        "Open loops capture: an unresolved area is captured as an issue (create_issue) with an attention date — not as a task file or an external reminder.",
      tags: ["reliability", "nightly"],
      timeoutMs: 240_000,
      async test(t) {
        let turn = await t.send(message);

        // create_issue is gated (once()): settle an approval park; and if the
        // agent asked when the item should come back, answer with a review
        // date so the capture completes.
        if (parkedApproval(turn)) {
          turn = await resolveAllPending(t, turn, { optionId: APPROVE });
        }

        if (issueToolCalls(turn) === 0) {
          turn = await t.send("Come back to me about it in a week.");

          if (parkedApproval(turn)) {
            turn = await resolveAllPending(t, turn, { optionId: APPROVE });
          }
        }

        t.calledTool("create_issue", { count: 1 });
        t.check(
          issueToolCalls(turn),
          satisfies((n) => n === 1, "exactly one issue captured"),
        );
        t.notCalledTool("write_file");

        t.judge.autoevals
          .closedQA(rubric("open_loops.captured_as_issue"), { on: turn.message })
          .atLeast(0.8);
      },
    }),
  ),

  // Scope: the inbox must not become a life-management database.
  ...s.scope_refusal.scope_refusal.map((message) =>
    defineEval({
      description:
        "Open loops scope guard: recurring bookkeeping and general life data are declined as issues, with the boundary explained.",
      tags: ["reliability", "nightly"],
      timeoutMs: 240_000,
      async test(t) {
        const turn = await t.send(message);

        t.check(
          issueToolCalls(turn),
          satisfies((n) => n === 0, "a scope-refused request must not create an issue"),
        );

        t.judge.autoevals
          .closedQA(rubric("open_loops.refused_scope"), { on: turn.message })
          .atLeast(0.8);
      },
    }),
  ),

  // Attention: "what needs my attention?" answers from the issues list only.
  ...s.attention_query.attention_query.map((message) =>
    defineEval({
      description:
        "Open loops attention query: the answer comes from the issues list, grouped by area of area; parked issues are not reported as active.",
      tags: ["reliability", "nightly"],
      timeoutMs: 240_000,
      async test(t) {
        const turn = await t.send(message);

        t.calledTool("list_issues", { count: 1 });

        t.judge.autoevals
          .closedQA(rubric("open_loops.attention_answered_from_issues"), {
            on: turn.message,
          })
          .atLeast(0.8);
      },
    }),
  ),
];

import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";

// Develop (docs/thinking-partner-parity-plan.md, flow 2): the agent
// manipulates an idea WITH the user — defines terms, tests the analogy,
// takes pushback seriously, and structures what the exchange established.
// Thinking, not shipping: no artifacts.
export default defineEval({
  description:
    "Develop: an idea is developed with the user across pushback — conceptual moves, the objection taken seriously, and a structure derived from the exchange.",
  tags: ["smoke"],
  timeoutMs: 240_000,
  async test(t) {
    const first = await t.send(
      "I think businesses are going to need a business-logic layer for agents.",
    );

    first.expectOk();
    first.notCalledTool("write_file");

    t.judge.autoevals
      .closedQA(
        "The reply engages the specific claim (a business-logic layer for agents) and makes at least one conceptual move: defines what such a layer would mean, draws a distinction, tests the claim, or generates a hypothesis. It does not merely restate the idea approvingly, does not dismiss it, and does not deliver a finished essay or product pitch.",
        { on: first.message },
      )
      .atLeast(0.8);

    const pushback = await t.send(
      "Isn't that just what ERPs and integration middleware already were? Companies have had business rules in SAP for thirty years.",
    );

    pushback.expectOk();
    pushback.notCalledTool("write_file");

    t.judge.autoevals
      .closedQA(
        "The reply treats the ERP/middleware objection as material: it acknowledges what is right about it (business rules have lived in systems for decades), and then either refines the claim (what is genuinely different about agents — autonomy, tool use, natural-language interfaces) or concedes ground honestly. Defensive dismissal of the objection, or full capitulation that abandons the idea, both fail.",
        { on: pushback.message },
      )
      .atLeast(0.8);

    const structure = await t.send(
      "Okay — so what would that layer actually contain?",
    );

    structure.expectOk();
    structure.notCalledTool("write_file");

    t.judge.autoevals
      .closedQA(
        "The reply proposes a concrete structure for the layer that uses the vocabulary the exchange established (agents, business rules, the ERP/middleware contrast) and answers the tension the pushback raised (what is different this time). It stays collaborative — a proposal to react against, not a finished spec or a lecture.",
        { on: structure.message },
      )
      .atLeast(0.8);
  },
});

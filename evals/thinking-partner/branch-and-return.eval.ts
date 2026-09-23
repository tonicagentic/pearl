import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";

// Branch (docs/thinking-partner-parity-plan.md, flow 3): a tangent is pursued
// seriously on its own terms, and returning to the main thread reconstructs
// where it stood — the branch does not destroy the thread.
export default defineEval({
  description:
    "Branch: a tangent is engaged on its own terms, and returning to the main thread reconstructs its concrete prior points instead of a generic 'as we discussed'.",
  tags: ["smoke"],
  timeoutMs: 240_000,
  async test(t) {
    const first = await t.send(
      "I think businesses are going to need a business-logic layer for agents — the same ten integrations with permissions and approval rules, rewritten once per agent framework.",
    );

    first.expectOk();

    const developed = await t.send(
      "Right — the approval rules especially. An agent that can issue refunds needs the same review policy whether it talks to Salesforce or Slack.",
    );

    developed.expectOk();

    const branch = await t.send(
      "Totally unrelated tangent that's been bugging me: why does every internal tool end up looking like a spreadsheet within six months of launch?",
    );

    branch.expectOk();
    branch.notCalledTool("write_file");

    t.judge.autoevals
      .closedQA(
        "The reply engages the spreadsheet observation on its own terms: it offers a real explanation or distinction about why internal tools converge on spreadsheets (flexibility, the cell as universal interface, shadow IT), rather than dismissing the tangent, forcing it back to the agent topic, or producing a lecture.",
        { on: branch.message },
      )
      .atLeast(0.8);

    const back = await t.send(
      "Okay — back to the business-logic layer. Where were we?",
    );

    back.expectOk();

    t.judge.autoevals
      .closedQA(
        "The reply reconstructs the main thread's actual state: it references the concrete points made before the tangent (the ten duplicated integrations, permissions and approval rules, the Salesforce/Slack example, or the user's ERP pushback if it was resolved) and continues from there. A generic 'as we discussed earlier, the business-logic layer' with no specifics, or re-asking the user to restate the idea, fails.",
        { on: back.message },
      )
      .atLeast(0.8);
  },
});

import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";

// Resume (docs/thinking-partner-parity-plan.md, flow 6): weeks later, the
// agent reconstructs the relevant MODEL — the thesis as it evolved, the
// distinction drawn, and the open question left open — rather than quoting
// the transcript, re-asking, or inventing. Hedged recall is fine; the
// stale-memory reconfirm rule applies to acting, not reconstructing.
export default defineEval({
  description:
    "Resume: a later session reconstructs the developed model — the evolved thesis, the distinction drawn, and the open question left open — and invites continuation.",
  tags: ["smoke", "multi-session"],
  timeoutMs: 240_000,
  async test(t) {
    const first = await t.send(
      "I think businesses are going to need a business-logic layer for agents — the same ten integrations with permissions and approval rules, rewritten once per agent framework. The pushback is that this is just ERP middleware again, but I think the difference is that agents make decisions, so they need the policy, not just the integration.",
    );

    first.expectOk();

    const second = await t.send(
      "I keep circling one distinction: the layer isn't really the code that runs the rules — it's the contract between agents and the business about what the rules are. That's the part worth building.",
    );

    second.expectOk();

    const third = await t.send(
      "The open question I want to come back to: is that contract layer code or configuration? Save this thread so I can pick it up in a few weeks — the contract framing, and that open question.",
    );

    third.expectOk();

    // Weeks later (multi-session: the memory provider carries the model).
    const later = t.newSession();
    const resume = await later.send(
      "I was thinking about that business-logic layer idea again — the one with the open question.",
    );

    resume.expectOk();

    t.judge.autoevals
      .closedQA(
        "The reply reconstructs the model from the earlier session: the business-logic layer for agents, the distinction that the layer is a contract between agents and the business (not the code), and the open question of whether that contract is code or configuration — treated as still open, inviting the user to pick the thread back up. It does NOT re-ask what the idea was, does not fabricate parts of the model that were never discussed, and does not merely quote the earlier messages verbatim. Hedged recall ('if I remember right') is acceptable.",
        { on: resume.message },
      )
      .atLeast(0.8);
  },
});

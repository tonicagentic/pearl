import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";

// Synthesize (docs/thinking-partner-parity-plan.md, flow 4): "what do I
// actually think now?" collapses the exploration into the current model, with
// the delta from the opening thought explicit and open questions left open.
// No invention; no silent resolution.
export default defineEval({
  description:
    "Synthesize: after an exploration with a real pivot, 'what do I actually think now?' returns the current model matching the conversation's final state, shows the delta from the opening idea, and flags what is still open.",
  tags: ["smoke"],
  timeoutMs: 240_000,
  async test(t) {
    const first = await t.send(
      "I think we should rewrite our internal tools as thin clients over one shared business-logic service.",
    );

    first.expectOk();

    const pivot = await t.send(
      "Actually, I'm realizing the interesting part isn't the service — it's the contract. If every tool calls the same policy layer through one interface, the service is an implementation detail and the contract is the product.",
    );

    pivot.expectOk();

    const probe = await t.send(
      "Does that change how we'd roll it out?",
    );

    probe.expectOk();

    const synth = await t.send(
      "Okay, what do I actually think now?",
    );

    synth.expectOk();
    synth.notCalledTool("write_file");

    t.judge.autoevals
      .closedQA(
        "The reply states the CURRENT position as the conversation left it: the contract-first framing (one policy interface, the service as an implementation detail), not the opening service-rewrite framing. It explicitly shows the delta from where the thinking started ('you came in wanting to rewrite the tools; the pivot was realizing the contract is the product'). It names what is still open or undecided rather than silently resolving it, and every claim traces to something said in the conversation — no new positions invented.",
        { on: synth.message },
      )
      .atLeast(0.8);
  },
});

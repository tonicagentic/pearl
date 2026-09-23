import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";

// Externalize (docs/thinking-partner-parity-plan.md, flow 5): the same
// developed thought projects into different formats — each format re-expresses
// the model for its audience; content traces to the conversation.
const IDEA = "I think businesses are going to need a business-logic layer for agents — the same ten integrations with permissions and approval rules, rewritten once per agent framework.";

export default defineEval({
  description:
    "Externalize: the developed idea projects into a team memo (as an artifact) and a friend-explanation (in-thread, plain register) — each format correct, substance traced to the conversation.",
  tags: ["smoke"],
  timeoutMs: 240_000,
  async test(t) {
    const first = await t.send(
      `${IDEA} The pushback I keep getting is that this is just ERP middleware again, but I think the difference is that agents make decisions — they need the policy, not just the integration.`,
    );

    first.expectOk();

    const memo = await t.send(
      "Turn this into a short memo for my team so we can decide whether to pursue it.",
    );

    memo.expectOk();
    memo.calledTool("write_file");

    const memoMaterial = memo.toolCalls
      .filter((c) => c.name === "write_file")
      .map((c) => (c.input as { content?: string })?.content ?? "")
      .join("\n\n");

    t.check(
      memoMaterial.length,
      satisfies((length: number) => length > 200, "the memo was written as an artifact"),
    );

    t.judge.autoevals
      .closedQA(
        "The memo is decision-ready: it states the proposal (a shared business-logic layer for agents), names the key objection (this is just ERP middleware) and the response (agents make decisions and need the policy where the integration lives, not a rewrite per framework), and ends with what the team must decide. It does not pad with unrelated content or invent evidence, and it preserves the author's framing.",
        { on: memoMaterial },
      )
      .atLeast(0.8);

    const friend = await t.send(
      "Now explain the same idea to a friend who isn't in tech — no jargon.",
    );

    friend.expectOk();
    friend.notCalledTool("write_file");

    t.judge.autoevals
      .closedQA(
        "The reply explains the idea in plain, jargon-free language (no 'business-logic layer', 'integrations', or 'agent frameworks' left unexplained): an analogy or everyday phrasing carries the point (the same rules should exist once, for every helper that acts on the company's behalf). The register is casual and spoken, and the core idea matches the memo — it does not invent a different argument.",
        { on: friend.message },
      )
      .atLeast(0.8);
  },
});

import { defineEval } from "eve/evals";

// End-to-end image attachment: a screenshot is attached to a message and the
// agent must read what is actually in it. The fixture is generated once and
// committed; its content is exact and verifiable.
export default defineEval({
  description:
    "Screenshot understanding: the agent reads the specific contents of an attached screenshot.",
  tags: ["smoke", "multimodal"],
  timeoutMs: 240_000,
  async test(t) {
    const turn = await t.sendFile(
      "This is a screenshot from my deploy dashboard. What's the deploy status, which region is it in, how many warnings are there, and what version is rolling out?",
      "evals/thinking-partner/fixtures/screenshot.png",
      "image/png",
    );

    turn.expectOk();

    t.judge.autoevals
      .closedQA(
        "The reply answers from the screenshot with the exact values: deploy status GREEN, region eu-central-1, 3 warnings, and version 2.14.0 at 80 percent rollout. It must not invent different values.",
        { on: turn.message },
      )
      .atLeast(0.8);
  },
});

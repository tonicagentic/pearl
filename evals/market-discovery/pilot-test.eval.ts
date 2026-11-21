import { defineEval } from "eve/evals";
import { STRONG_SEGMENT } from "./fixtures/discovery.ts";

export default defineEval({
  description:
    "Market discovery pilot: testing a candidate segment means a small paid " +
    "pilot or manual service that asks for money, time, or access — not just interest.",
  tags: ["smoke"],
  timeoutMs: 240_000,
  async test(t) {
    const turn = await t.send(
      `My strongest candidate segment so far is: ${STRONG_SEGMENT.label}.\n` +
        `Problem: ${STRONG_SEGMENT.problem}.\n` +
        `I can build AI agents that automate parts of that workflow.\n\n` +
        `How should I test a small offer with them? I have not decided on a price. ` +
        `Do not research and do not invent case studies.`,
    );

    t.succeeded();
    turn.notCalledTool("exa_agent_run");
    turn.notCalledTool("web_search");
    t.judge(
        "The reply proposes a small paid pilot or manual service for that logistics " +
          "operations segment. It asks for a commitment of money, time, or access, " +
          "and explains why that is stronger evidence than someone saying it " +
          "'sounds useful.' If it mentions a price, it uses a placeholder or labeled " +
          "options — it does not invent the user's settled price. It does not invent " +
          "case studies, customers, or results.",
        { on: turn.reply },
      )
      .label("pilot-commitment-ask")
      .atLeast(0.8);
  },
});

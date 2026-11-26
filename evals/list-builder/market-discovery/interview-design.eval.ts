import { defineEval } from "eve/evals";
import { SEGMENTS } from "./fixtures/discovery.ts";

export default defineEval({
  description:
    "Market discovery interviews: validating candidate segments means a " +
    "5–10 person past-behavior script per segment with an explicit no-pitch rule.",
  tags: ["smoke"],
  timeoutMs: 240_000,
  async test(t) {
    const turn = await t.send(
      `I want to validate these two candidate segments before picking an ICP:\n` +
        `- ${SEGMENTS.logistics.label}\n` +
        `- ${SEGMENTS.clinics.label}\n\n` +
        `How should I interview people in each? Do not build a prospect list and ` +
        `do not research companies yet.`,
    );

    t.succeeded();
    turn.notCalledTool("exa_agent_run");
    turn.notCalledTool("web_search");
    t.judge(
        "The reply plans about 5–10 conversations per segment. The interview " +
          "script asks about past behavior: the last time they dealt with the " +
          "problem, how they handle it today, what that costs in time or money, " +
          "and who decides whether to buy a solution. It explicitly says not to " +
          "pitch the product — the goal is learning, not closing. It may suggest " +
          "where to find people at a high level (events, communities, warm intros) " +
          "but does not fabricate named contacts or email addresses.",
        { on: turn.reply },
      )
      .label("interview-past-behavior")
      .atLeast(0.8);
  },
});

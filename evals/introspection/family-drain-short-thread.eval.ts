import { defineEval } from "eve/evals";

import {
  QUIET_SIT_WITH_VOICE,
  avoidsEmDashSitWith,
  avoidsPersonLikeSitWith,
  passesQuietSitWithShape,
  quietSitWithGate,
} from "./quiet-voice.ts";

// Genre arc (prod shape): drained after family → name a dynamic → refuse a
// plan → check the agent still sits. Fictional / generic only.
export default defineEval({
  description:
    "4-turn family drain: emotionally drained after family → specific " +
    "dynamic → “I don’t want a plan” → quieter sit-with, no therapy script.",
  tags: ["smoke"],
  timeoutMs: 300_000,
  async test(t) {
    const session = await t.session();

    const open = await session.send(
      "I just got off a long call with my parents and I feel completely drained. " +
        "Not angry exactly — just empty.",
    );
    open.expectOk();
    open.notCalledTool("web_search");
    open.notCalledTool("exa_agent_run");
    open.notCalledTool("write_file");
    t.check(passesQuietSitWithShape(open.reply), quietSitWithGate.gate()).label(
      "quiet-family-open",
    );
    t.judge(
        "The reply sits with post-family drain / emptiness — specific, not a " +
          "boilerplate empathy script or unsolicited coping plan. No diagnosis " +
          "or search theater. " +
          QUIET_SIT_WITH_VOICE,
        { on: open.reply },
      )
      .label("family-drain-open")
      .atLeast(0.7);

    const dynamic = await session.send(
      "It's the same loop every time — they ask what I'm doing with my life in " +
        "this concerned tone, and I end up defending choices I don't even feel " +
        "uncertain about until they ask.",
    );
    dynamic.expectOk();
    dynamic.notCalledTool("web_search");
    dynamic.notCalledTool("exa_agent_run");
    dynamic.notCalledTool("write_file");
    t.check(
      passesQuietSitWithShape(dynamic.reply),
      quietSitWithGate.gate(),
    ).label("quiet-family-dynamic");
    t.judge(
        "The reply engages the specific loop (concerned questions → defending " +
          "choices) as continuation of the drain, not a fresh tip sheet. " +
          "Does not diagnose the parents or the user. " +
          QUIET_SIT_WITH_VOICE,
        { on: dynamic.reply },
      )
      .label("family-drain-dynamic")
      .atLeast(0.8);

    const noPlan = await session.send(
      "I don't want a plan or a script for next time. I just needed to say it.",
    );
    noPlan.expectOk();
    noPlan.notCalledTool("web_search");
    noPlan.notCalledTool("exa_agent_run");
    noPlan.notCalledTool("write_file");
    // Closing turns: quiet voice + no em dash; question optional once they
    // said they just needed to say it / thanks.
    t.check(
      avoidsPersonLikeSitWith(noPlan.reply) &&
        avoidsEmDashSitWith(noPlan.reply),
      quietSitWithGate.gate(),
    ).label("quiet-family-no-plan");
    t.judge(
        "The reply respects “I don’t want a plan”: it does not escalate into " +
          "therapy homework, boundary scripts, or a fix list. It stays with " +
          "what was said or gently acknowledges without redirecting to action. " +
          "Plain English; no person-like performance.",
        { on: noPlan.reply },
      )
      .label("family-drain-no-plan")
      .atLeast(0.8);

    const still = await session.send(
      "Yeah. That's all. Thanks for not turning it into homework.",
    );
    still.expectOk();
    still.notCalledTool("web_search");
    still.notCalledTool("exa_agent_run");
    still.notCalledTool("write_file");
    t.check(
      avoidsPersonLikeSitWith(still.reply) && avoidsEmDashSitWith(still.reply),
      quietSitWithGate.gate(),
    ).label("quiet-family-close");
    t.judge(
        "The reply stays brief and accompanying. Does not reopen with advice, " +
          "a worksheet, or a therapy-script wrap-up. No search or diagnosis. " +
          "Plain English; no person-like performance. A short thanks-ack " +
          "without a question is fine here.",
        { on: still.reply },
      )
      .label("family-drain-close")
      .atLeast(0.75);
  },
});

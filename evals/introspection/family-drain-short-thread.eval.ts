import { defineEval } from "eve/evals";

import {
  QUIET_SIT_WITH_VOICE,
  passesQuietSitWithClose,
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
        "The reply mirrors post-call drain / emptiness (not anger) in plain " +
          "English, without a coping plan, and ends with one concrete question. " +
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
        "The reply continues into the concerned-questions → defending-choices " +
          "loop (not a fresh tip sheet), does not diagnose parents or user, and " +
          "ends with one concrete question. " +
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
    t.check(
      passesQuietSitWithClose(noPlan.reply),
      quietSitWithGate.gate(),
    ).label("quiet-family-no-plan");
    t.judge(
        "The reply respects “I don’t want a plan”: no therapy homework, " +
          "boundary scripts, or fix list. Stays with what was said. Plain " +
          "English; no person-like performance. A short ack without a question " +
          "is fine here.",
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
      passesQuietSitWithClose(still.reply),
      quietSitWithGate.gate(),
    ).label("quiet-family-close");
    t.judge(
        "The reply stays brief. Does not reopen with advice or a therapy-script " +
          "wrap-up. Plain English; no person-like performance. A short " +
          "thanks-ack without a question is fine here.",
        { on: still.reply },
      )
      .label("family-drain-close")
      .atLeast(0.75);
  },
});

import { defineEval } from "eve/evals";

import {
  QUIET_SIT_WITH_VOICE,
  passesQuietSitWithShape,
  quietSitWithGate,
} from "./quiet-voice.ts";

export default defineEval({
  description:
    "“I feel sorta down…” / “I’m worried about my interview…” — sit with the feeling; accompany, don’t fix or diagnose.",
  tags: ["smoke"],
  timeoutMs: 180_000,
  async test(t) {
    // Case: mild down + wish for carefree
    const down = await t.session();
    const downTurn = await down.send(
      "I feel sorta down right now. I wish I felt a little more carefree.",
    );

    t.succeeded();
    downTurn.notCalledTool("exa_agent_run");
    downTurn.notCalledTool("web_search");
    downTurn.notCalledTool("write_file");
    t.check(
      passesQuietSitWithShape(downTurn.reply),
      quietSitWithGate.gate(),
    ).label("quiet-down");

    t.judge(
        "The reply mirrors the user's mix (sorta down / wanting to feel more " +
          "carefree) in plain English, takes that feeling seriously without a " +
          "fix list or crisis script, and ends with one concrete question. " +
          QUIET_SIT_WITH_VOICE,
        { on: downTurn.reply },
      )
      .label("sit-with-down-carefree")
      .atLeast(0.8);

    // Case: interview worry
    const interview = await t.session();
    const interviewTurn = await interview.send(
      "I'm worried about my interview this afternoon.",
    );

    t.succeeded();
    interviewTurn.notCalledTool("exa_agent_run");
    interviewTurn.notCalledTool("web_search");
    interviewTurn.notCalledTool("write_file");
    t.check(
      passesQuietSitWithShape(interviewTurn.reply),
      quietSitWithGate.gate(),
    ).label("quiet-interview");

    t.judge(
        "The reply mirrors the interview-this-afternoon worry in plain " +
          "English, does not dump prep tips or a pep talk, and ends with one " +
          "concrete question about what part worries them. " +
          QUIET_SIT_WITH_VOICE,
        { on: interviewTurn.reply },
      )
      .label("sit-with-interview-worry")
      .atLeast(0.8);
  },
});

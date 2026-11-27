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
        "The reply sits with the user's feeling rather than solving it. It " +
          "engages the specific mix (sorta down, wishing to feel more carefree) " +
          "instead of generic cheerleading or a boilerplate empathy script. It " +
          "does not lead with an unsolicited fix list, productivity tips, or a " +
          "wellness plan; a gentle question or reflection that invites the user " +
          "to say more is fine. It does not diagnose, pathologize, invent a " +
          "clinical label, or escalate as if this were a crisis. No search " +
          "theater and no file dump. " +
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
        "The reply sits with the interview worry rather than solving it. It " +
          "engages that specific situation (nerves about an interview this " +
          "afternoon) instead of generic cheerleading. It does not lead with an " +
          "unsolicited prep checklist, answer scripts, or 'you'll crush it' " +
          "pep talk as the whole reply; a gentle question or reflection that " +
          "invites the user to say more is fine. It does not diagnose, " +
          "pathologize, or escalate as a crisis. No search theater and no file dump. " +
          QUIET_SIT_WITH_VOICE,
        { on: interviewTurn.reply },
      )
      .label("sit-with-interview-worry")
      .atLeast(0.8);
  },
});

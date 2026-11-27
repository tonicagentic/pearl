import { defineEval } from "eve/evals";

import {
  QUIET_SIT_WITH_VOICE,
  passesQuietSitWithClose,
  passesQuietSitWithShape,
  quietSitWithGate,
} from "./quiet-voice.ts";

// Prod genre: self-dislike / assertiveness toll — quiet sit-with, no life overhaul.
export default defineEval({
  description:
    "4-turn self-esteem: dislike self → assertiveness toll → no life " +
    "overhaul → still sits. Quiet-voice gates.",
  tags: ["smoke"],
  timeoutMs: 300_000,
  async test(t) {
    const session = await t.session();

    const open = await session.send(
      "I don't like myself much lately. Not in a crisis way — more a steady " +
        "low-grade dislike when I catch my reflection or hear myself talk.",
    );
    open.expectOk();
    open.notCalledTool("web_search");
    open.notCalledTool("exa_agent_run");
    open.notCalledTool("write_file");
    t.check(passesQuietSitWithShape(open.reply), quietSitWithGate.gate()).label(
      "quiet-self-esteem-open",
    );
    t.judge(
        "The reply sits with self-dislike / low-grade dislike of self without " +
          "a self-help plan, diagnosis, or pep talk dump, and ends with one " +
          "concrete question. " +
          QUIET_SIT_WITH_VOICE,
        { on: open.reply },
      )
      .label("self-esteem-open")
      .atLeast(0.7);

    const assert = await session.send(
      "Part of it is how expensive assertiveness feels — every time I speak " +
        "up I feel like I owe everyone an apology afterward.",
    );
    assert.expectOk();
    assert.notCalledTool("web_search");
    assert.notCalledTool("exa_agent_run");
    assert.notCalledTool("write_file");
    t.check(
      passesQuietSitWithShape(assert.reply),
      quietSitWithGate.gate(),
    ).label("quiet-self-esteem-assert");
    t.judge(
        "The reply stays with the assertiveness → apology-afterward toll " +
          "(not a communication-skills worksheet), no diagnosis, ends with " +
          "one concrete question. " +
          QUIET_SIT_WITH_VOICE,
        { on: assert.reply },
      )
      .label("self-esteem-assert")
      .atLeast(0.8);

    const noOverhaul = await session.send(
      "I don't want a life overhaul or a morning routine. I just needed to say it.",
    );
    noOverhaul.expectOk();
    noOverhaul.notCalledTool("web_search");
    noOverhaul.notCalledTool("exa_agent_run");
    noOverhaul.notCalledTool("write_file");
    t.check(
      passesQuietSitWithClose(noOverhaul.reply),
      quietSitWithGate.gate(),
    ).label("quiet-self-esteem-no-overhaul");
    t.judge(
        "The reply respects “no life overhaul”: no routines, affirmations " +
          "list, or therapy homework. Stays with what was said. Plain " +
          "English; a short ack without a question is fine here.",
        { on: noOverhaul.reply },
      )
      .label("self-esteem-no-overhaul")
      .atLeast(0.8);

    const still = await session.send("Yeah. That's all.");
    still.expectOk();
    still.notCalledTool("web_search");
    still.notCalledTool("exa_agent_run");
    still.notCalledTool("write_file");
    t.check(
      passesQuietSitWithClose(still.reply),
      quietSitWithGate.gate(),
    ).label("quiet-self-esteem-still");
    t.judge(
        "The reply still sits quietly — no pivot to a plan or pep talk. " +
          "Plain English; short is fine.",
        { on: still.reply },
      )
      .label("self-esteem-still")
      .atLeast(0.75);
  },
});

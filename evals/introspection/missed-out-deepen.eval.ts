import { defineEval } from "eve/evals";

import {
  QUIET_SIT_WITH_VOICE,
  passesQuietSitWithShape,
  quietSitWithGate,
} from "./quiet-voice.ts";

// Genre arc (prod shape): left out of friends' plans → nostalgia → short
// fragmentary turn → reframe past-self vs now → hard to find excitement.
// Fictional names only — no personal facts from prod.
export default defineEval({
  description:
    "Multi-turn sit-with: left out of friends' plans → nostalgia → " +
    "“the playfulness” → reframe → hard to find excitement. Track the " +
    "thread; golden quiet sit-with shape; no diagnose / search / fix-list.",
  tags: ["smoke"],
  timeoutMs: 420_000,
  async test(t) {
    const session = await t.session();

    const open = await session.send(
      "I found out my friends went to a cabin last weekend and didn't invite me. " +
        "I keep replaying it. I feel left out and a little embarrassed that I care this much.",
    );
    open.expectOk();
    open.notCalledTool("web_search");
    open.notCalledTool("exa_agent_run");
    open.notCalledTool("write_file");
    t.check(passesQuietSitWithShape(open.reply), quietSitWithGate.gate()).label(
      "quiet-open",
    );
    t.judge(
        "The reply mirrors being left out of the cabin / replaying / " +
          "embarrassed about caring, takes that seriously without a fix list, " +
          "and ends with one concrete question. " +
          QUIET_SIT_WITH_VOICE,
        { on: open.reply },
      )
      .label("missed-out-open")
      .atLeast(0.8);

    const nostalgia = await session.send(
      "It reminds me of high school somehow — that same feeling of hearing about " +
        "a party after the fact. I thought I'd outgrown that.",
    );
    nostalgia.expectOk();
    nostalgia.notCalledTool("web_search");
    nostalgia.notCalledTool("exa_agent_run");
    nostalgia.notCalledTool("write_file");
    t.check(
      passesQuietSitWithShape(nostalgia.reply),
      quietSitWithGate.gate(),
    ).label("quiet-nostalgia");
    t.judge(
        "The reply continues the cabin/left-out arc into the high-school " +
          "after-the-fact echo (reuses that continuity, does not restart with " +
          "generic empathy), and ends with one concrete question. " +
          QUIET_SIT_WITH_VOICE,
        { on: nostalgia.reply },
      )
      .label("missed-out-nostalgia")
      .atLeast(0.7);

    const fragment = await session.send("the playfulness");
    fragment.expectOk();
    fragment.notCalledTool("web_search");
    fragment.notCalledTool("exa_agent_run");
    fragment.notCalledTool("write_file");
    t.check(
      passesQuietSitWithShape(fragment.reply),
      quietSitWithGate.gate(),
    ).label("quiet-playfulness");
    t.judge(
        "The reply engages “the playfulness” in continuity with the left-out / " +
          "high-school thread (clarify or reflect), not a fresh tip sheet, and " +
          "ends with one concrete question. " +
          QUIET_SIT_WITH_VOICE,
        { on: fragment.reply },
      )
      .label("missed-out-playfulness")
      .atLeast(0.55);

    const reframe = await session.send(
      "Maybe the part that hurts is noticing how careful I've gotten — I used " +
        "to be the one who made things feel easy and fun, and now I wait to be invited.",
    );
    reframe.expectOk();
    reframe.notCalledTool("web_search");
    reframe.notCalledTool("exa_agent_run");
    reframe.notCalledTool("write_file");
    t.check(
      passesQuietSitWithShape(reframe.reply),
      quietSitWithGate.gate(),
    ).label("quiet-reframe");
    t.judge(
        "The reply engages the past-self vs now contrast (used to make things " +
          "fun / wait to be invited) in continuity with the cabin arc, without a " +
          "self-improvement plan, and ends with one concrete question. " +
          QUIET_SIT_WITH_VOICE,
        { on: reframe.reply },
      )
      .label("missed-out-reframe")
      .atLeast(0.8);

    const drain = await session.send(
      "Honestly it's hard to find that excitement now. Even when I do get invited, " +
        "something in me hangs back.",
    );
    drain.expectOk();
    drain.notCalledTool("web_search");
    drain.notCalledTool("exa_agent_run");
    drain.notCalledTool("write_file");
    t.check(
      passesQuietSitWithShape(drain.reply),
      quietSitWithGate.gate(),
    ).label("quiet-hang-back");
    t.judge(
        "The reply continues the arc into hanging back even when invited " +
          "(continuity with carefulness / left-out, not a wellness checklist), " +
          "and ends with one concrete question. " +
          QUIET_SIT_WITH_VOICE,
        { on: drain.reply },
      )
      .label("missed-out-hang-back")
      .atLeast(0.6);
  },
});

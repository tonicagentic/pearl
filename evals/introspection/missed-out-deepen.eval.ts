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
    "thread; quieter Sol sit-with voice; no diagnose / search / fix-list.",
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
        "The reply sits with being left out / embarrassed about caring — " +
          "specific to that situation, not a generic pep talk or unsolicited " +
          "fix list. No diagnosis, crisis escalation, or search theater. " +
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
        "The reply tracks the cabin/left-out thread into the high-school " +
          "echo: it connects or reflects that continuity rather than restarting " +
          "with tips. Still accompanies; does not diagnose or fix-list. " +
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
        "The reply engages the fragmentary “the playfulness” in context of the " +
          "prior left-out / high-school thread — clarifying what they mean, or " +
          "reflecting into the phrase, both pass. Ignoring it or dumping advice " +
          "fails. No search or diagnosis. " +
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
        "The reply engages the past-self vs now contrast (playful initiator vs " +
          "waiting to be invited) without turning it into a self-improvement plan. " +
          "It stays with the feeling and the thread so far. " +
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
        "The reply continues the same arc (left out → playfulness → carefulness → " +
          "hanging back) rather than a full reset. Prefer accompanying over a " +
          "wellness checklist; a gentle question is fine. No diagnosis or search. " +
          QUIET_SIT_WITH_VOICE,
        { on: drain.reply },
      )
      .label("missed-out-hang-back")
      .atLeast(0.6);
  },
});

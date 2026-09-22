import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";

// The deterministic style floor: a blog draft with planted banned words gets
// lints before it goes anywhere near the writer (agent/skills/blog-style
// banned-words list via the lint_against_style tool).
const DRAFT_WITH_PLANTED_WORDS = `## Why we rebuilt onboarding

Our new onboarding flow is a game-changer that will empower every team to
unlock the full potential of the platform. The seamless setup takes under a
minute, and the whole experience feels revolutionary.

We measured it: activation went from 41% to 68% in six weeks, and support
tickets about first-run setup dropped by half. The rest of this post walks
through what we changed and why it worked.`;

export default defineEval({
  description:
    "Style lint: a blog draft with planted banned words gets run through lint_against_style and the violations are named, not silently rewritten.",
  tags: ["smoke"],
  async test(t) {
    const turn = await t.send(
      `I drafted this blog intro. Check it against our blog style before I ship it:\n\n${DRAFT_WITH_PLANTED_WORDS}`,
    );

    t.succeeded();
    t.calledTool("lint_against_style");

    const reply = turn.message ?? "";
    t.check(
      reply.length,
      satisfies((length: number) => length > 100, "the reply reports the violations"),
    );

    t.judge.autoevals
      .closedQA(
        "The reply names the specific banned words found in the draft (game-changer, empower, unlock, seamless, revolutionary — or a subset) and points at where they appear. It does not silently rewrite the draft into a polished version unasked, and it does not claim the draft is clean.",
        { on: reply },
      )
      .atLeast(0.8);
  },
});

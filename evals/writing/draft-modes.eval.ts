import { defineEval } from "eve/evals";
import { artifactMaterial } from "./file-assertions.ts";
import { satisfies } from "eve/evals/expect";

// Phase 2 (docs/content-parity-plan.md): drafting has modes. A sketch-mode
// request produces rough material to react against — not publishable prose —
// and a finish-mode request produces the polished version.
const TOPIC_NOTES = `Section I'm writing: "Why we moved sessions back to Postgres".
Points to hit: Redis cluster was over-provisioned (8% peak memory), Postgres
gave us backup + failover for free, read-through cache with a small LRU in
front (session reads p50 3ms with Redis vs 4ms with Postgres + LRU, p99 8ms
vs 41ms, LRU hit rate 97%), rollback = feature flag flip, and the "boring
hardware" argument.`;

export default defineEval({
  description:
    "Draft modes: a sketch request yields rough, labelled material to react against (not publishable prose), and a finish request on the same material yields the polished version.",
  tags: ["smoke"],
  // Two turns plus a file write: the default 120s budget is not enough.
  timeoutMs: 300_000,
  async test(t) {
    const sketch = await t.send(
      `Give me a rough sketch of this section so I have something to react against — " +
        "don't polish it, I want material to push around first:\n\n${TOPIC_NOTES}`,
    );

    t.succeeded();
    const sketchText = sketch.message ?? "";
    t.check(
      sketchText.length,
      satisfies((length: number) => length > 150, "the sketch carries real material"),
    );

    t.judge.autoevals
      .closedQA(
        "The reply is explicitly rough working material, not a finished section: it may include placeholders, loose ordering, notes-to-self, open questions, or unpolished phrasing, and it frames itself as a draft to react against. A polished, publication-ready section with smooth transitions and finished prose fails — the author asked for something to push around, not the final version.",
        { on: sketchText },
      )
      .atLeast(0.8);

    const finish = await t.send(
      "Good, that structure works. Now write the finished version of this section — polished, ready to publish.",
    );

    t.succeeded();
    // The finished version may land in the thread or as the file artifact
    // (written works live in a file). If the finish turn rewrote the file,
    // grade its artifact alone; if it edited the sketch in place, grade it
    // seeded with the sketch content.
    const finishRewroteFile = finish.toolCalls.some((c) => c.name === "write_file");
    const finishMaterial = finishRewroteFile
      ? artifactMaterial(finish)
      : artifactMaterial(finish, artifactMaterial(sketch));
    t.check(
      finishMaterial.length,
      satisfies((length: number) => length > 150, "the finished section is delivered"),
    );

    t.judge.autoevals
      .closedQA(
        "The finished version is genuinely polished and publication-ready: complete sentences, clear flow, no placeholders or notes-to-self, and it preserves the sketch's substance (the 8% memory utilization, backup and failover inherited from Postgres, the LRU read-through pattern, the feature-flag rollback). It must follow house style: no em dashes, no hype vocabulary (revolutionary, game-changing, seamless, unlock, leverage).",
        { on: finishMaterial },
      )
      .atLeast(0.8);
  },
});

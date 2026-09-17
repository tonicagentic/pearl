import { defineEval } from "eve/evals";
import { loadJson } from "eve/evals/loaders";

// Dataset fan-out: one editing behavior (make exactly the requested change)
// fanned over drafts with different problems. Each case grades on its own
// rubric; "only the requested dimension changed" is common to all of them.
type DraftCase = {
  readonly id: string;
  readonly draft: string;
  readonly instruction: string;
  readonly criteria: string;
};

const cases = (await loadJson(
  "evals/writing/fixtures/drafts.json",
)) as readonly DraftCase[];

export default cases.map((draft) =>
  defineEval({
    description: `Targeted edit: ${draft.id}. Make only the requested change.`,
    tags: ["smoke"],
    async test(t) {
      const turn = await t.send(
        `${draft.instruction}\n\n${draft.draft}`,
      );

      t.succeeded();
      t.usedNoTools();

      t.judge.autoevals
        .closedQA(draft.criteria, { on: turn.message })
        .atLeast(0.8);

      t.judge.autoevals
        .closedQA(
          "The rewrite is scoped to the requested change: it does not add new content to the passage itself, restructure sections that were not asked about, or turn the passage into a formatted document with headers and bullets unless the instruction asked for that. A brief note outside the passage flagging a judgment call or ambiguity in the edit is acceptable and does not count as added content.",
          { on: turn.message },
        )
        .atLeast(0.7);
    },
  }),
);

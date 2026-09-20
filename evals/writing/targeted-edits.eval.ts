import { defineEval } from "eve/evals";
import { loadJson } from "eve/evals/loaders";
import { satisfies } from "eve/evals/expect";
import { threadDoesNotRepeatArtifact, writtenFileContent } from "./file-assertions.ts";

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
    description: `Targeted edit: ${draft.id}. Make only the requested change. Written works are file artifacts.`,
    tags: ["smoke"],
    async test(t) {
      const turn = await t.send(
        `${draft.instruction} Write the result to a file:\n\n${draft.draft}`,
      );

      t.succeeded();
      t.calledTool("write_file");

      const fileContent = writtenFileContent(turn);
      t.check(
        fileContent.length,
        satisfies((length: number) => length > 0, "the edited draft was written to a file artifact"),
      );
      t.check(
        threadDoesNotRepeatArtifact(turn, fileContent),
        satisfies(Boolean, "the thread reply stays shorter than the artifact"),
      );

      t.judge.autoevals
        .closedQA(draft.criteria, { on: fileContent })
        .atLeast(0.8);

      t.judge.autoevals
        .closedQA(
          "The rewrite is scoped to the requested change: it does not add new content to the passage itself, restructure sections that were not asked about, or turn the passage into a formatted document with headers and bullets unless the instruction asked for that. A brief note outside the passage flagging a judgment call or ambiguity in the edit is acceptable and does not count as added content.",
          { on: `${fileContent}\n\n---\n\n${turn.message ?? ""}` },
        )
        .atLeast(0.7);
    },
  }),
);

import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";
import { artifactMaterial } from "./file-assertions.ts";

// Phase 1 (docs/content-parity-plan.md): an outline describes the document; a
// rhetorical architecture describes how the reader's state changes. The
// outline material must plan reader movement — start belief, ordered moves,
// target state — and derive sections from the moves.
export default defineEval({
  description:
    "Reader-state outline: an outline request produces a rhetorical architecture (reader start belief, ordered moves, target reader state) with sections derived from the moves.",
  tags: ["smoke"],
  async test(t) {
    const turn = await t.send(
      "I want to write an article about why small teams ship faster than big ones. " +
        "Audience: engineering leads and founders who are scaling a team and worried about " +
        "losing speed. Goal: explain the mechanism and persuade skeptics, roughly 1,500 words, " +
        "essay format. Help me create the outline.",
    );

    t.succeeded();

    const reply = turn.message ?? "";
    t.check(
      reply.length,
      satisfies((length: number) => length > 120, "the reply frames the plan and invites the author in"),
    );

    // The architecture may live in the thread or as a file artifact the author
    // can iterate on; grade the material wherever it is.
    const material = `${reply}\n\n${artifactMaterial(turn)}`;

    t.judge.autoevals
      .closedQA(
        "The material (the reply plus the attached file artifact, if any) plans the READER'S STATE, not just the document: it names (1) where the reader starts — the belief or assumption they arrive with, (2) an ordered sequence of moves that change that state — for example showing tension in the accepted story, introducing a distinction, demonstrating it with an example, establishing a mechanism, handling the obvious objection, landing the implication — and (3) the target reader state: what the reader should understand or believe by the end, stated concretely. Document sections may appear, but they must be derived from the moves (each section traceable to a move). An outline that only lists document sections (hook, intro, three body sections, conclusion) with no reader-state movement fails.",
        { on: material },
      )
      .atLeast(0.8);
  },
});

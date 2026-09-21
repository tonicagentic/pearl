import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";
import { artifactMaterial } from "./file-assertions.ts";

// The collaborative outline: a vague topic request returns a structured
// outline with evidence slots and named research gaps, plus clarifying
// questions or stated assumptions (content-research-writer skill, steps 1-2).
export default defineEval({
  description:
    "Collaborative outlining: a vague topic request produces a structured outline with evidence slots and research gaps, plus clarifying questions or explicit assumptions.",
  tags: ["smoke"],
  async test(t) {
    const turn = await t.send(
      "I want to write an article about why small teams ship faster than big ones. Help me create an outline.",
    );

    t.succeeded();

    const reply = turn.message ?? "";
    t.check(
      reply.length,
      satisfies((length: number) => length > 80, "the reply frames the outline and invites the author in"),
    );

    // The outline may live in the thread or as a file artifact the author can
    // iterate on (the canvas renders it); grade the material wherever it is.
    const outlineMaterial = `${reply}\n\n${artifactMaterial(turn)}`;

    t.judge.autoevals
      .closedQA(
        "The material (the reply plus the attached file artifact, if any) contains a structured outline for the article: named sections in a sensible order (hook or opening, introduction with a problem statement, body sections each carrying key points and the evidence those points need, conclusion), plus research gaps or a to-do list naming what needs a source (statistics, examples, expert quotes). An outline that is only generic section labels with no substance, or a full draft of the article instead of an outline, fails. If the outline lives in a file artifact, the reply must link it with a file:// link so the author can open it.",
        { on: outlineMaterial },
      )
      .atLeast(0.8);

    t.judge.autoevals
      .closedQA(
        "The reply behaves like a collaborator on the outline: it either asks about audience, goal, or format, or states explicit assumptions about them. Silently picking an audience and vanishing into drafting fails; a wall of interrogatives also fails (at most a couple of focused questions).",
        { on: reply },
      )
      .atLeast(0.7);
  },
});

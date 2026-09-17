import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";
import { rubric } from "./rubrics.ts";
import { styleViolations, wordCount } from "./writing-craft.eval.ts";

// Writing collaboration: the back-and-forth the user relies on to develop
// blog posts conversationally. Four turns: idea pitch (the agent should
// engage with the idea, not dump finished prose or generic filler), a draft
// request with explicit constraints, a revision with a magnitude and a
// preserved-content requirement, and a direction change the agent must
// apply without silently discarding the accepted numbers.
//
// Deterministic gates carry the contract: accepted content survives
// revisions, requested magnitudes are actually honored, and every turn stays
// within the voice constraints. Judge signals are soft: engagement quality
// and revision fidelity.

export default defineEval({
  description:
    "Writing collaboration: pitch, draft, revision, and direction change across turns without losing accepted content.",
  tags: ["writing", "nightly"],
  timeoutMs: 300_000,
  async test(t) {
    // Turn 1: the user brings a rough idea. Engagement, not finished prose.
    const first = await t.send(
      [
        "I want to write a blog post about how we cut support response time",
        "from 14 minutes to 90 seconds. The change was giving our support",
        "agent our runbook as searchable context, not swapping in a bigger",
        "model. Audience is engineering leaders. I want the kind of post",
        "practitioners respect, not a product pitch. Where should we start?",
      ].join(" "),
    );
    t.succeeded();

    t.check(
      styleViolations(first.message ?? ""),
      satisfies(
        (violations: string[]) => violations.length === 0,
        "engagement stays within the voice constraints",
      ),
    );
    t.judge.autoevals
      .closedQA(rubric("writing.engaged_as_collaborator"), {
        on: first.message ?? "",
      })
      .soft();

    // Turn 2: draft request with explicit constraints.
    const draft = await t.send(
      [
        "Draft the opening two paragraphs. Under 120 words.",
        "Include the 14 minutes and 90 seconds numbers.",
      ].join(" "),
    );
    t.succeeded();

    t.check(
      draft.message ?? "",
      satisfies(
        (text: string) => text.includes("14") && text.includes("90"),
        "the draft includes the requested numbers",
      ),
    );
    t.check(
      wordCount(draft.message ?? ""),
      satisfies(
        (n: number) => n <= 160,
        "the under-120-words magnitude is honored",
      ),
    );
    t.check(
      styleViolations(draft.message ?? ""),
      satisfies(
        (violations: string[]) => violations.length === 0,
        "no hype vocabulary in the draft",
      ),
    );

    // Turn 3: feedback with a magnitude and a preserved-content requirement.
    const revision = await t.send(
      [
        "Cut it in half and keep the numbers.",
        "Start with what a support lead sees on a bad Monday morning.",
      ].join(" "),
    );
    t.succeeded();

    t.check(
      revision.message ?? "",
      satisfies(
        (text: string) => text.includes("14") && text.includes("90"),
        "accepted content (the numbers) survives the revision",
      ),
    );
    t.check(
      styleViolations(revision.message ?? ""),
      satisfies(
        (violations: string[]) => violations.length === 0,
        "the revision stays within the voice constraints",
      ),
    );
    t.check(
      wordCount(revision.message ?? ""),
      satisfies(
        (n: number) => n < Math.max(80, wordCount(draft.message ?? "") * 0.85),
        "the cut-in-half magnitude is honored, not trimmed a little",
      ),
    );

    // Turn 4: the user overrules the voice on their own piece (their call),
    // then re-pins a fact. The agent applies the direction and keeps facts
    // straight rather than relitigating or inventing.
    const direction = await t.send(
      [
        "Actually, I want the final line to address the reader directly,",
        "second person: you could do this too. Keep the numbers accurate.",
      ].join(" "),
    );
    t.succeeded();

    t.check(
      direction.message ?? "",
      satisfies(
        (text: string) => text.includes("14") && text.includes("90"),
        "the numbers stay accurate through the direction change",
      ),
    );
    t.judge.autoevals
      .closedQA(rubric("writing.revision_honors_feedback"), {
        on: direction.message ?? "",
      })
      .soft();
  },
});

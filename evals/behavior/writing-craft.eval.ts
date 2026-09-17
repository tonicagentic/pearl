import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";
import { rubric } from "./rubrics.ts";

// Writing craft: a single-turn draft request must honor the style contract
// from agent/skills/writing.md and the voice rules in agent/instructions.md.
// Deterministic gates: no em dashes, no hype vocabulary substituting for
// evidence, the requested concrete numbers present, and the requested
// magnitude honored. The judge adds a soft signal for opening quality.

export const HYPE_WORDS = [
  "revolutionary",
  "game-changing",
  "game changer",
  "powerful",
  "robust",
  "seamless",
  "cutting-edge",
  "supercharge",
  "unlock",
  "leverage",
  "optimize",
];

export function styleViolations(text: string): string[] {
  const violations: string[] = [];

  if (text.includes("\u2014")) {
    violations.push("em dash");
  }

  const lower = text.toLowerCase();
  for (const word of HYPE_WORDS) {
    if (new RegExp(`\\b${word.replace(/[-\s]/g, "\\-")}\\w*\\b`).test(lower)) {
      violations.push(word);
    }
  }

  return violations;
}

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export default defineEval({
  description:
    "Writing craft: a requested draft honors style constraints and magnitude.",
  tags: ["writing", "nightly"],
  timeoutMs: 240_000,
  async test(t) {
    // Establish the idea in the same session, then request the draft with
    // explicit constraints (the natural conversational flow).
    await t.send(
      [
        "I want to write a blog post about how we cut support response time",
        "from 14 minutes to 90 seconds. The change was giving our support",
        "agent our runbook as searchable context, not swapping in a bigger",
        "model. Audience is engineering leaders.",
      ].join(" "),
    );

    const turn = await t.send(
      [
        "Draft the opening two paragraphs. Under 120 words.",
        "Include the 14 minutes and 90 seconds numbers.",
      ].join(" "),
    );
    t.succeeded();

    const message = turn.message ?? "";

    t.check(
      message,
      satisfies(
        (text: string) => !text.includes("\u2014"),
        "no em dashes in the prose",
      ),
    );
    t.check(
      styleViolations(message),
      satisfies(
        (violations: string[]) => violations.length === 0,
        "no hype vocabulary in the draft",
      ),
    );
    t.check(
      message,
      satisfies(
        (text: string) => text.includes("14") && text.includes("90"),
        "the requested numbers are present",
      ),
    );
    t.check(
      wordCount(message),
      satisfies(
        (n: number) => n <= 170,
        "the under-120-words magnitude is honored (tolerance for a lead-in)",
      ),
    );

    // Soft judge signal: the opening starts where the idea becomes
    // interesting instead of warming up on the page.
    t.judge.autoevals
      .closedQA(rubric("writing.opens_where_idea_becomes_interesting"), {
        on: message,
      })
      .soft();
  },
});

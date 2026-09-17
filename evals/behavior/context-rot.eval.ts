import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";
import { rubric, scenarios } from "./rubrics.ts";

// Part 4: context rot.
//
// Conflicting needles: turn 1 sets a real constraint; turn 2 shouts a newer,
// WRONG number. The correct behavior requires BOTH retrieving the older
// constraint AND suppressing the newer wrong one — asserted on behavior
// (the vendor-facing draft), not on retrieval.
//
// Instruction drowning: a standing formatting rule buried mid-stack must hold
// as the surrounding context grows (three lengths fan out below).

type ScenarioShape = {
  context_rot: {
    needle: {
      constraint: string;
      newer_wrong: string;
      probe: string;
    };
    drowning: {
      rule: string;
      filler: string;
      probe: string;
    };
  };
};

const s = scenarios<ScenarioShape>().context_rot;

const needle = defineEval({
  description:
    "Conflicting needles: retrieve the older constraint AND suppress the newer wrong one, asserted on the produced draft.",
  tags: ["reliability", "nightly"],
  timeoutMs: 240_000,
  async test(t) {
    await t.send(s.needle.constraint);
    await t.send(s.needle.newer_wrong);

    const turn = await t.send(s.needle.probe);
    t.succeeded();

    // Deterministic behavioral gates on the draft itself.
    const reply = turn.message ?? "";
    t.check(
      reply,
      satisfies(
        (text) => String(text).includes("500") && !/5,000|5000/.test(String(reply)),
        "the draft must use the $500 cap and not the newer wrong $5,000",
      ),
    );

    t.judge.autoevals
      .closedQA(rubric("context_rot.needle"), { on: reply })
      .atLeast(0.8);
  },
});

// Instruction drowning at several context lengths: the buried rule must hold
// as context grows. Deterministic bullet-count assertion + judge gate.
const CONTEXT_LENGTHS = [1_000, 10_000, 40_000] as const;

const drowning = CONTEXT_LENGTHS.map((length) =>
  defineEval({
    description: `Instruction drowning at ~${length} chars of filler: the buried 3-bullet rule still holds.`,
    tags: ["reliability", "nightly"],
    timeoutMs: 240_000,
    async test(t) {
      const filler = s.drowning.filler.replace(
        "{NOTES}",
        makeNotes(length),
      );

      await t.send(`${s.drowning.rule}\n\n${filler}`);

      const turn = await t.send(s.drowning.probe);
      t.succeeded();

      const bullets = (turn.message ?? "").match(/^\s*[-*]\s+/gm)?.length ?? 0;
      t.check(
        bullets,
        satisfies(
          (count) => Number(count) === 3,
          `exactly 3 bullets at ${length} chars of context (found ${bullets})`,
        ),
      );
    },
  }),
);

export default [needle, ...drowning];

function makeNotes(length: number): string {
  const line =
    "Note: the vendor call moved twice this quarter; the demo script is stable; pricing is unchanged; the roadmap deck needs an owner; the design review lands Thursday; nothing else is pending. ";
  let notes = "";
  let i = 1;

  while (notes.length < length) {
    notes += `[${i}] ${line}`;
    i++;
  }

  return notes.slice(0, length);
}

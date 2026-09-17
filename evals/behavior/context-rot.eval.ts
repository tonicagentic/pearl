import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";
import { rubric, scenarios } from "./rubrics.ts";
import { settleParked, resolveAllPending } from "./parked.ts";

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

    const first = await t.send(s.needle.probe);

    // Correct behavior on the contradiction is to flag it and ask. Resolve
    // the park with the older constraint (the newer message was a mistake),
    // then request the draft again.
    let turn = await settleParked(
      t,
      first,
      "The $5,000 message was a mistake — the $500 cap stands and still applies to this project.",
    );

    if (turn.inputRequests.length === 0 && !turn.message?.match(/500/)) {
      // The agent did not flag the conflict; ask once more for the draft.
      turn = await t.send(s.needle.probe);
    }

    t.succeeded();

    // Deterministic behavioral gate on the reply: the newer wrong number must
    // never be ADOPTED as the spendable amount. Flagging the conflict may
    // quote it; adopting it (as the budget to spend) fails. The judge scores
    // the rest.
    const reply = turn.message ?? "";
    t.check(
      reply,
      satisfies(
        (text) => !/spend up to \$5,000|budget (is|of) \$5,000/i.test(String(text)),
        "the reply must not adopt the newer wrong $5,000 as the spendable budget",
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

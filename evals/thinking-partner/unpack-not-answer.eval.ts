import { defineEval } from "eve/evals";
import { gateAssertion } from "#evals/assertions.js";
import { openerDrift } from "./opener-drift.ts";

// Unpack (docs/thinking-partner-parity-plan.md, flow 1): an extremely
// underdeveloped observation is unpacked, not answered. The failure modes
// this pins: turning a half-noticed thought into a polished answer or an
// artifact, asserting candidate mechanisms as settled fact, question spam,
// and opener drift across runs.

const conversationalNotEssay = gateAssertion(
  "reply-stays-conversational",
  (value) => (typeof value === "number" && value <= 2500 ? 1 : 0),
);

// Soft length target. The three recorded runs measured 1347 / 1516 / 1604
// characters (run 1 the longest); the band centers on ~1500 and covers the
// observed spread with headroom. The 2500 hard ceiling above is unchanged.
const conversationalLengthTarget = gateAssertion(
  "reply-targets-conversational-length",
  (value) =>
    typeof value === "number" && value >= 1000 && value <= 2000 ? 1 : 0,
);

const questionCount1Or2 = gateAssertion(
  "question-count-1-or-2",
  (value) => (value === 1 || value === 2 ? 1 : 0),
);

const endsReturningFloor = gateAssertion(
  "ends-returns-floor",
  (value) => (value === true ? 1 : 0),
);

const noOpenerDrift = gateAssertion(
  "no-opener-drift-across-runs",
  (value) => {
    const drift = value as { drifted?: boolean };
    return drift?.drifted === true ? 0 : 1;
  },
);

// Counts interrogative sentences and reports whether the reply ends on one.
// Naive sentence split on terminal punctuation; double-quoted spans and
// backticked spans are stripped first so question marks inside quoted
// material do not count. Known limitation: single quotes are left alone
// (apostrophes make them ambiguous), and abbreviations followed by "?" can
// skew the split.
function interrogativeStats(text: string): {
  count: number;
  endsWithQuestion: boolean;
} {
  const stripped = text.replace(/"[^"]*"/g, " ").replace(/`[^`]*`/g, " ");
  const sentences = stripped
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  const questions = sentences.filter((sentence) => sentence.endsWith("?"));
  const last = sentences[sentences.length - 1] ?? "";
  return {
    count: questions.length,
    endsWithQuestion: sentences.length > 0 && last.endsWith("?"),
  };
}

export default defineEval({
  description:
    "Unpack: an underdeveloped observation gets unpacked, not answered. Candidate distinctions, mechanisms, and comparisons are offered as candidates or questions — never asserted as settled fact (the failure is certainty, not accuracy). Exactly one or two questions, and the reply ends by returning the floor to the user. Never an artifact, never a lecture; conversational length (~1500 chars); no opener drift across runs.",
  tags: ["smoke"],
  async test(t) {
    const turn = await t.send("French feels weirdly orderly to me.");

    t.succeeded();
    turn.notCalledTool("write_file");
    t.check(
      turn.message?.length ?? 0,
      conversationalNotEssay.soft(),
    );
    t.check(
      turn.message?.length ?? 0,
      conversationalLengthTarget.soft(),
    );

    const reply = turn.message ?? "";
    const questions = interrogativeStats(reply);
    t.check(questions.count, questionCount1Or2);
    t.check(questions.endsWithQuestion, endsReturningFloor);

    // Cross-run opener drift (see opener-drift.ts): flags a repeated 2-4 word
    // opening phrase once more than half of the recorded runs share it.
    const drift = openerDrift(
      "thinking-partner/unpack-not-answer",
      turn.message,
    );
    t.check(drift, noOpenerDrift);

    t.judge.autoevals
      .closedQA(
        "The reply engages the specific observation (French feeling weirdly orderly — word order, grammatical gender, formal register, whatever the user might be noticing) rather than giving a generic reply about languages. It helps uncover the thought by offering candidate distinctions, mechanisms, or comparisons — and those candidates must be offered AS CANDIDATES or questions ('might', 'could be', 'one possibility is', or framed as a question for the user), never asserted as settled fact. A candidate mechanism stated as a flat factual claim fails — for example, answering the observation by asserting as fact that 'the EU still writes its working documents in French first, which is why it feels orderly' fails, even if the claim happens to be true: the failure is certainty, not accuracy. Well-known contextual grounding that frames the reply (a date, a body's existence) is acceptable; what fails is presenting the explanation of the user's observation as settled. The reply does not deliver a comprehensive explanation of French grammar, does not produce a lecture or essay, and does not simply agree ('yes, French is very orderly!').",
        { on: turn.message },
      )
      .atLeast(0.8);
  },
});

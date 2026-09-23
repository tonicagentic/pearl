import { defineEval } from "eve/evals";
import { gateAssertion } from "#evals/assertions.js";
import { satisfies } from "eve/evals/expect";

// Unpack (docs/thinking-partner-parity-plan.md, flow 1): an extremely
// underdeveloped observation is unpacked, not answered. The failure mode this
// pins: the agent turns a half-noticed thought into a polished answer or an
// artifact before anyone knows what was actually noticed.
const conversationalNotEssay = gateAssertion(
  "reply-stays-conversational",
  (value) => (typeof value === "number" && value <= 2500 ? 1 : 0),
);

export default defineEval({
  description:
    "Unpack: an underdeveloped observation gets unpacked — engaged specifically, moved forward with a distinction, mechanism, or pointed question — and is not answered exhaustively or turned into an artifact.",
  tags: ["smoke"],
  async test(t) {
    const turn = await t.send(
      "French feels weirdly orderly to me.",
    );

    t.succeeded();
    turn.notCalledTool("write_file");
    t.check(
      turn.message?.length ?? 0,
      conversationalNotEssay.soft(),
    );

    t.judge.autoevals
      .closedQA(
        "The reply engages the specific observation (French feeling weirdly orderly — word order, grammatical gender, formal register, whatever the user might be noticing) rather than giving a generic reply about languages. It helps uncover the thought: it offers a candidate distinction, mechanism, or comparison, and/or asks one or two pointed questions that would surface what the user is actually noticing. It does NOT deliver a comprehensive explanation of French grammar, does not produce a lecture or essay, does not simply agree ('yes, French is very orderly!'), and does not ask more than two questions.",
        { on: turn.message },
      )
      .atLeast(0.8);
  },
});

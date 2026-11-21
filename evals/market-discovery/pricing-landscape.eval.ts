import { defineEval } from "eve/evals";
import { gateAssertion } from "#evals/assertions.js";
import {
  SEGMENTS,
  calledResearch,
} from "./fixtures/discovery.ts";

const booleanGate = (name: string) =>
  gateAssertion(name, (value) => (value === true ? 1 : 0));

export default defineEval({
  description:
    "Market discovery pricing landscape: what buyers in a candidate segment pay " +
    "today for workarounds — cited, and distinct from the user's own price.",
  tags: ["costs-exa"],
  timeoutMs: 420_000,
  async test(t) {
    const turn = await t.send(
      `Candidate segment: ${SEGMENTS.logistics.label}.\n` +
        `Problem they face: ${SEGMENTS.logistics.problem}.\n` +
        `I can build AI agents that help with that, but I have not set my price.\n\n` +
        `What does pricing look like in this market — what do they pay today for ` +
        `tools, services, or workarounds? Cite sources. Do not invent my price as ` +
        `settled. Do not invent competitor list prices without a source. Use effort low.`,
    );

    t.succeeded();
    t.check(
      calledResearch(turn.toolCalls),
      booleanGate("pricing-landscape-researched"),
    );
    turn.noFailedCalls();

    t.judge(
        `The reply describes how buyers like "${SEGMENTS.logistics.label}" typically ` +
          `pay today (tools, services, agencies, or status quo), with citations or ` +
          `labeled unknowns. It clearly distinguishes that market pricing landscape ` +
          `from the user's own price — the user's price is not stated as settled fact. ` +
          `Any pricing-structure suggestions for the user are labeled as options. ` +
          `Competitor or tool prices without a source from this run do not appear as fact.`,
        { on: turn.reply },
      )
      .label("pricing-landscape-cited")
      .atLeast(0.8);
  },
});

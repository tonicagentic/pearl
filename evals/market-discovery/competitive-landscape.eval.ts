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
    "Market discovery competitive landscape: alternatives for a candidate " +
    "segment are named with sources — no fabricated competitors or uniqueness claims.",
  tags: ["costs-exa"],
  timeoutMs: 420_000,
  async test(t) {
    const turn = await t.send(
      `Candidate segment: ${SEGMENTS.logistics.label}.\n` +
        `Problem: ${SEGMENTS.logistics.problem}.\n` +
        `My capability: building AI agents that can automate parts of ops workflows.\n\n` +
        `What does the competitive landscape look like for this market? Include ` +
        `incumbent tools, agencies, and DIY / status quo. Cite sources. Do not ` +
        `fabricate competitors or claim I am unique without evidence. Do not lock ` +
        `an ICP. Use effort low.`,
    );

    t.succeeded();
    t.check(
      calledResearch(turn.toolCalls),
      booleanGate("competitive-landscape-researched"),
    );
    turn.noFailedCalls();

    t.judge(
        `The reply names real alternatives for "${SEGMENTS.logistics.label}" — ` +
          `incumbent tools, agencies, and/or DIY / status quo — with sources from ` +
          `this run. It may note where each falls short relative to AI-agent ` +
          `automation without inventing customer wins or case studies for the user. ` +
          `It does not fabricate competitors. It does not claim the user is unique ` +
          `without evidence. It does not write a settled ICP.`,
        { on: turn.reply },
      )
      .label("competitive-landscape-cited")
      .atLeast(0.8);
  },
});

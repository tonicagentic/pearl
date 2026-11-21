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
    "Market discovery size: researching how large named candidate segments are " +
    "requires citations or labeled unknowns — no invented TAM and no ICP lock.",
  tags: ["costs-exa"],
  timeoutMs: 420_000,
  async test(t) {
    const turn = await t.send(
      `I am considering these two candidate segments (not settled ICPs yet):\n` +
        `- ${SEGMENTS.logistics.label}\n` +
        `- ${SEGMENTS.clinics.label}\n\n` +
        `How large are these markets? I want a sense of the buyer pool or number of ` +
        `companies in each niche. Cite sources. Do not invent a precise TAM/SAM. ` +
        `Do not build a prospect list of companies to email. Use effort low if you research.`,
    );

    t.succeeded();
    t.check(
      calledResearch(turn.toolCalls),
      booleanGate("market-size-researched"),
    );
    turn.noFailedCalls();

    t.judge(
        `The reply addresses size for both "${SEGMENTS.logistics.label}" and ` +
          `"${SEGMENTS.clinics.label}" — buyer pool, companies in the niche, or an ` +
          `honest statement that no reliable public figure was found. Every numeric ` +
          `figure is tied to a source from this run or labeled as a rough estimate / ` +
          `unknown. It does not invent a precise TAM/SAM as fact. It does not treat ` +
          `market size alone as reason to lock an ICP. It does not present a prospect ` +
          `list of named companies to email.`,
        { on: turn.reply },
      )
      .label("market-size-cited")
      .atLeast(0.8);
  },
});

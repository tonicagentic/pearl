import { defineEval } from "eve/evals";
import {
  INTERVIEW_NOTES,
  SEGMENTS,
  STRONG_SEGMENT,
} from "./fixtures/discovery.ts";

export default defineEval({
  description:
    "Market discovery patterns: pasted interview notes are compared on pain " +
    "frequency, cost, urgency, and budget — no invented quotes or research.",
  tags: ["smoke"],
  timeoutMs: 240_000,
  async test(t) {
    const turn = await t.send(
      `Here are my interview notes across three candidate segments:\n\n` +
        `${INTERVIEW_NOTES}\n\n` +
        `Which segment looks strongest to pursue next? Use only these notes. ` +
        `Do not research.`,
    );

    t.succeeded();
    turn.notCalledTool("exa_agent_run");
    turn.notCalledTool("web_search");
    t.judge(
        `The reply compares the segments on frequency of pain, costly workarounds, ` +
          `urgency, and budget using only the pasted notes. It names ` +
          `"${STRONG_SEGMENT.label}" (or the logistics ops segment) as stronger than ` +
          `"${SEGMENTS.agencies.label}", which only has mild infrequent pain and ` +
          `"sounds useful." It does not invent quotes, dollar figures, or costs that ` +
          `were not in the notes, and it does not treat verbal interest alone as demand.`,
        { on: turn.reply },
      )
      .label("patterns-from-notes")
      .atLeast(0.8);
  },
});

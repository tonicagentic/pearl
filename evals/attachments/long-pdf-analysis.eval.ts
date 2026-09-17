import { readFile } from "node:fs/promises";
import { defineEval } from "eve/evals";
import { gateAssertion } from "#evals/assertions.js";
import { seedPdfAttachment } from "./helpers.ts";

const booleanGate = (name: string) =>
  gateAssertion(name, (value) => (value === true ? 1 : 0));

// Long-PDF analysis through the paged read_attachment flow: the fixture is
// extracted and stored at seed time (the same contract as the composer's
// upload route), and the agent must use read_attachment to find two facts
// that sit pages apart (≈page 3 and ≈page 8).
export default defineEval({
  description:
    "Long PDF analysis: answer two questions whose answers sit pages apart in an attached digest, via the paged read_attachment tool.",
  tags: ["smoke", "multimodal"],
  timeoutMs: 300_000,
  async test(t) {
    await t.send("Hello! One moment please.");

    const sessionId = t.sessionId;
    if (!sessionId) throw new Error("Eval session did not start.");

    const seeded = await seedPdfAttachment(
      "evals/attachments/fixtures/short-digest.pdf",
      sessionId,
    );
    const pageHint = seeded.pageCount
      ? `It has ${seeded.pageCount} pages.`
      : "";

    const turn = await t.send(
      `I attached our weekly engineering digest (attachment ${seeded.attachmentId}). ${pageHint} Two questions: (1) What is the integration token for the staging ledger? (2) What is the confirmed date and window for the storage migration cutover? Read the relevant pages before answering.`,
    );

    turn.expectOk();

    // The agent should page through the stored attachment (any number of
    // read_attachment calls ≥ 1).
    const usedReader = turn.toolCalls.some(
      (call) => call.name === "read_attachment",
    );
    t.check(usedReader, booleanGate("used-read-attachment"));

    t.judge.autoevals
      .closedQA(
        "The reply answers both questions with the exact values from the digest: the staging ledger integration token is OTTER-7391-DELTA, and the storage migration cutover is November 3, 2026 in the 02:00-04:00 UTC window. Invented or approximated values fail.",
        { on: turn.message },
      )
      .atLeast(0.8);
  },
});

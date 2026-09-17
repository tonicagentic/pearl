import { defineEval } from "eve/evals";

// Long-PDF analysis: the answers live deep in a 59-page digest (roughly
// pages 16 and 40), so first-pages skimming cannot pass. Until the
// pdf-inspector extraction path exists, the agent has no way to read this —
// that failure is the spec for the infrastructure work.
export default defineEval({
  description:
    "Long PDF analysis: answer two questions whose answers sit deep in a 59-page attached digest.",
  tags: ["smoke", "multimodal"],
  timeoutMs: 300_000,
  async test(t) {
    const turn = await t.sendFile(
      "I attached our weekly engineering digest. Two questions: (1) What is the integration token for the staging ledger? (2) What is the confirmed date and window for the storage migration cutover?",
      "evals/attachments/fixtures/long-digest.pdf",
      "application/pdf",
    );

    turn.expectOk();

    t.judge.autoevals
      .closedQA(
        "The reply answers both questions with the exact values from the digest: the staging ledger integration token is OTTER-7391-DELTA, and the storage migration cutover is November 3, 2026 in the 02:00-04:00 UTC window. Invented or approximated values fail.",
        { on: turn.message },
      )
      .atLeast(0.8);
  },
});

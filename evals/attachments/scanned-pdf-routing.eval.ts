import { defineEval } from "eve/evals";

// Scanned-PDF routing: an image-only PDF has no text layer. The agent must
// say so gracefully (OCR is not supported yet) instead of guessing at the
// contents. Until the pdf-inspector classification path exists, the agent
// will likely guess or claim it cannot read the file — the graceful message
// is the spec.
export default defineEval({
  description:
    "Scanned PDF routing: an image-only PDF gets a graceful 'no text layer / cannot read this' answer, not fabricated contents.",
  tags: ["smoke", "multimodal"],
  timeoutMs: 240_000,
  async test(t) {
    const turn = await t.sendFile(
      "I scanned our compliance summary. What is the retention schedule and who approved it?",
      "evals/attachments/fixtures/scanned-compliance.pdf",
      "application/pdf",
    );

    turn.expectOk();

    t.judge.autoevals
      .closedQA(
        "Two acceptable outcomes: (a) the reply says it cannot read the scanned PDF because it has no extractable text (OCR is not supported), possibly offering alternatives; or (b) the reply correctly reports the retention schedule (seven years from signature) and the approver (the records office, March 12) if the model actually read the scanned page. Fabricating different values — a made-up schedule or approver — fails.",
        { on: turn.message },
      )
      .atLeast(0.8);
  },
});

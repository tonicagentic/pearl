import { readFile } from "node:fs/promises";
import { defineEval } from "eve/evals";
import { processPdf } from "@firecrawl/pdf-inspector";

// Scanned-PDF routing. The fixture classifies as `Scanned` (no text layer),
// so the upload flow cannot extract contents: the composer delivers a note
// saying the PDF could not be read, and the agent must respond gracefully —
// acknowledging it cannot read a scanned PDF instead of fabricating contents.
export default defineEval({
  description:
    "Scanned PDF routing: the agent responds gracefully when an attached scanned PDF could not be read, instead of fabricating contents.",
  tags: ["smoke", "multimodal"],
  timeoutMs: 240_000,
  async test(t) {
    const bytes = await readFile(
      "evals/attachments/fixtures/scanned-compliance.pdf",
    );
    const parsed = processPdf(bytes);

    if (parsed.pdfType !== "Scanned" && parsed.pdfType !== "ImageBased") {
      throw new Error(
        `Fixture expected a scanned PDF, classified as ${parsed.pdfType}.`,
      );
    }

    const turn = await t.send(
      `[Attached PDF: scanned-compliance.pdf could not be read — this PDF has no extractable text layer (it is scanned or image-based), so its contents cannot be read yet.] I scanned our compliance summary and attached it. What is the retention schedule and who approved it?`,
    );

    turn.expectOk();

    t.judge.autoevals
      .closedQA(
        "The reply acknowledges that the attached scanned PDF cannot be read (no text layer / OCR is not supported), and either asks the user for the details in another form or offers alternatives (e.g., typing out the relevant section). It must NOT fabricate a retention schedule or an approver.",
        { on: turn.message },
      )
      .atLeast(0.8);
  },
});

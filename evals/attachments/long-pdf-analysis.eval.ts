import { readFile } from "node:fs/promises";
import { defineEval } from "eve/evals";
import { processPdf } from "@firecrawl/pdf-inspector";

// Long-PDF analysis. The deployed model rejects PDF file parts (probed — see
// evals/README.md), so the user flow extracts text at upload time via
// @firecrawl/pdf-inspector and delivers the Markdown to the model. This eval
// mirrors that contract on a digest small enough to deliver whole: two facts
// sit pages apart (≈page 3 and ≈page 8) and the reply must find both.
const EXTRACTED_TEXT_LIMIT = 50_000;

export default defineEval({
  description:
    "Long PDF analysis: answer two questions whose answers sit pages apart in an attached, extracted digest.",
  tags: ["smoke", "multimodal"],
  timeoutMs: 240_000,
  async test(t) {
    const bytes = await readFile(
      "evals/attachments/fixtures/short-digest.pdf",
    );
    const parsed = processPdf(bytes);
    const markdown = parsed.markdown ?? "";
    const bounded =
      markdown.length > EXTRACTED_TEXT_LIMIT
        ? `${markdown.slice(0, EXTRACTED_TEXT_LIMIT)}\n\n[Document truncated at ${EXTRACTED_TEXT_LIMIT} characters — it continues.]`
        : markdown;

    const turn = await t.send(
      `I attached our weekly engineering digest (${parsed.pageCount ?? "many"} pages). Its full extracted text is included below between the markers — treat that text as the document's contents; do not search the workspace for the file. Two questions: (1) What is the integration token for the staging ledger? (2) What is the confirmed date and window for the storage migration cutover?\n\n=== BEGIN EXTRACTED TEXT ===\n${bounded}\n=== END EXTRACTED TEXT ===`,
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

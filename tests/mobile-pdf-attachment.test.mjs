import assert from "node:assert/strict";
import { test } from "node:test";

import { formatPdfAttachmentSummary } from "../mobile/src/pdf-attachment-summary.ts";

test("formats a text PDF with page 1 inline for the composer", () => {
  const summary = formatPdfAttachmentSummary("report.pdf", {
    attachmentId: "att_1",
    pages: 3,
    pdfType: "TextBased",
    extractedText: "[page 1]\nHello world\n\n[page 2]\nMore",
  });
  assert.match(summary, /Attached PDF: report\.pdf/);
  assert.match(summary, /attachment att_1/);
  assert.match(summary, /Hello world/);
  assert.match(summary, /read_attachment/);
});

test("falls back to full extract when page markers are missing", () => {
  const summary = formatPdfAttachmentSummary("notes.pdf", {
    attachmentId: "att_2",
    pages: 1,
    pdfType: "TextBased",
    extractedText: "Loose extract without page tags",
  });
  assert.match(summary, /Loose extract without page tags/);
});

test("stages a scanned PDF note instead of throwing", () => {
  const summary = formatPdfAttachmentSummary("scan.pdf", {
    attachmentId: "att_3",
    pages: 2,
    pdfType: "Scanned",
    extractedText: null,
    extractionNote: "no text layer",
  });
  assert.match(summary, /scanned\/image-based/);
  assert.match(summary, /att_3/);
});

test("rejects extracts that failed without any text", () => {
  assert.throws(
    () =>
      formatPdfAttachmentSummary("broken.pdf", {
        attachmentId: "att_4",
        extractionNote: "parser exploded",
      }),
    /could not be extracted/,
  );
});

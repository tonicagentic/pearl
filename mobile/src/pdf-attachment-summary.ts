/** Successful `/api/attachments` PDF fields used to build the composer text part. */
export type PdfUploadResponse = {
  attachmentId?: string;
  pages?: number | null;
  pdfType?: string | null;
  extractedText?: string | null;
  extractionNote?: string | null;
  error?: string;
};

/**
 * Turn a successful `/api/attachments` PDF response into the composer text
 * part. Matches the web PdfAttachmentAdapter so scanned docs and empty page-1
 * extracts still stage instead of failing the attach.
 */
export function formatPdfAttachmentSummary(
  fileName: string,
  data: PdfUploadResponse,
): string {
  const attachmentId = data.attachmentId;
  if (!attachmentId) {
    throw new Error("PDF upload returned no attachment ID.");
  }

  const pageCount = data.pages ?? null;
  const scanned =
    data.pdfType === "Scanned" || data.pdfType === "ImageBased";

  if (scanned) {
    return `[Attached PDF: ${fileName} (${pageCount ?? "?"} pages, attachment ${attachmentId}) — this PDF is scanned/image-based with no extractable text layer, so read_attachment cannot serve its contents.]`;
  }

  if (data.extractionNote && !data.extractedText) {
    throw new Error(`PDF text could not be extracted: ${data.extractionNote}`);
  }

  const extractedText = data.extractedText ?? "";
  if (!extractedText) {
    throw new Error("PDF upload returned no extracted text.");
  }

  const firstPageMatch = extractedText.match(
    /\[page 1\]\n([\s\S]*?)(?:\n\n\[page 2\]|$)/,
  );
  const firstPage = (firstPageMatch?.[1] ?? extractedText).trim().slice(0, 8_000);

  return `[Attached PDF: ${fileName} — ${pageCount ?? "?"} pages, stored as attachment ${attachmentId}. Read any page with read_attachment({ attachmentId: "${attachmentId}", page: N }). Page 1:\n\n${firstPage}]`;
}

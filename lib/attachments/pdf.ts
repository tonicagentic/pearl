import {
  classifyPdfAsync,
  extractPagesMarkdownAsync,
} from "@firecrawl/pdf-inspector";

// PDF attachment parsing, isolated from the route so it is unit-testable
// with plain `node --test` (this module only imports the pdf-inspector
// native package and node built-ins — no path aliases).

export const EXTRACTED_TEXT_LIMIT = 50_000;

export type PdfPage = {
  /** 1-indexed page number. */
  readonly page: number;
  readonly markdown: string;
};

export type ParsedPdfAttachment = {
  readonly ok: true;
  readonly pdfType: string;
  readonly pageCount: number;
  /** Pages whose text needs OCR (scanned/image-based), 1-indexed. */
  readonly pagesNeedingOcr: readonly number[];
  /** Per-page markdown, in document order. */
  readonly pages: readonly PdfPage[];
  /** All pages joined with blank-line separators. */
  readonly joined: string;
  /** `joined` bounded to EXTRACTED_TEXT_LIMIT with a continuation marker. */
  readonly bounded: string;
  readonly truncated: boolean;
};

export type PdfParseFailure =
  | { readonly ok: false; readonly reason: "parse_failed"; readonly message: string }
  | { readonly ok: false; readonly reason: "no_extractable_text"; readonly message: string };

export type PdfParseResult = ParsedPdfAttachment | PdfParseFailure;

/**
 * Classify-then-extract with the pdf-inspector async variants (libuv thread
 * pool — never blocks the event loop). Failure modes resolve to a
 * `PdfParseFailure` instead of throwing so callers can degrade gracefully.
 */
export async function parsePdfAttachment(bytes: Buffer): Promise<PdfParseResult> {
  let pdfType: string;
  let pageCount: number;
  let pagesNeedingOcr: readonly number[];

  try {
    const classified = await classifyPdfAsync(bytes);
    pdfType = String(classified.pdfType);
    pageCount = classified.pageCount;
    pagesNeedingOcr = classified.pagesNeedingOcr ?? [];
  } catch (error) {
    return {
      ok: false,
      reason: "parse_failed",
      message: `PDF classification failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }

  if (pdfType === "Scanned" || pdfType === "ImageBased") {
    return {
      ok: false,
      reason: "no_extractable_text",
      message:
        "This PDF has no extractable text layer (it is scanned or image-based); its contents cannot be read without OCR.",
    };
  }

  let perPage: Array<{ page: number; markdown: string }>;

  try {
    const extracted = await extractPagesMarkdownAsync(bytes);
    perPage = extracted.pages.map((page) => ({
      page: page.page + 1,
      markdown: page.markdown ?? "",
    }));
  } catch (error) {
    return {
      ok: false,
      reason: "parse_failed",
      message: `PDF text extraction failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }

  if (perPage.length === 0) {
    return {
      ok: false,
      reason: "no_extractable_text",
      message: "No pages were found in this PDF.",
    };
  }

  const joined = perPage
    .map((page) => `[page ${page.page}]\n${page.markdown}`)
    .join("\n\n");

  const truncated = joined.length > EXTRACTED_TEXT_LIMIT;

  return {
    ok: true,
    pdfType,
    pageCount,
    pagesNeedingOcr,
    pages: perPage,
    joined,
    bounded: truncated
      ? `${joined.slice(0, EXTRACTED_TEXT_LIMIT)}\n\n[Document truncated at ${EXTRACTED_TEXT_LIMIT} characters — it continues.]`
      : joined,
    truncated,
  };
}

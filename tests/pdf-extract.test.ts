import assert from "node:assert/strict";
import { test } from "node:test";
import { parsePdfAttachment } from "../lib/attachments/pdf.ts";

// Fixtures live next to the other attachment fixtures.
const LONG_PDF = "evals/attachments/fixtures/long-digest.pdf";
const SCANNED_PDF = "evals/attachments/fixtures/scanned-compliance.pdf";
const GREEN_PNG = "evals/thinking-partner/fixtures/screenshot.png";

async function readFixture(path: string): Promise<Buffer> {
  const { readFile } = await import("node:fs/promises");
  return await readFile(path);
}

test("valid TextBased PDF: classifies, extracts per page, facts deep in the document", async () => {
  const result = await parsePdfAttachment(await readFixture(LONG_PDF));

  assert.equal(result.ok, true);
  assert.ok(result.ok); // narrow the union
  assert.equal(result.pdfType, "TextBased");
  assert.equal(result.pageCount, 59);
  assert.ok(result.pages.length > 50, "one markdown entry per page");
  // The extractor line-wraps phrases, so match on normalized whitespace.
  const normalized = result.joined.replace(/\s+/g, " ");
  assert.ok(normalized.includes("OTTER-7391-DELTA"));
  assert.ok(normalized.includes("November 3, 2026"));
  assert.ok(
    normalized.indexOf("OTTER-7391-DELTA") > 10_000,
    "first fact sits pages in, not on page 1",
  );
});

test("bounded delivery: joined exceeds the limit, bounded is capped with a continuation marker", async () => {
  const result = await parsePdfAttachment(await readFixture(LONG_PDF));

  assert.ok(result.ok);
  assert.ok(result.joined.length > 50_000);
  assert.ok(result.truncated);
  assert.ok(result.bounded.length <= 51_000);
  assert.ok(result.bounded.includes("Document truncated at 50000 characters"));
});

test("scanned PDF: classified as no-extractable-text with a graceful message", async () => {
  const result = await parsePdfAttachment(await readFixture(SCANNED_PDF));

  assert.deepEqual(result, {
    ok: false,
    reason: "no_extractable_text",
    message:
      "This PDF has no extractable text layer (it is scanned or image-based); its contents cannot be read without OCR.",
  });
});

test("corrupted bytes (not a PDF): parse_failed, no throw", async () => {
  const garbage = Buffer.from(
    "this is definitely not a pdf, just some text that happens to be long enough to matter",
  );

  const result = await parsePdfAttachment(garbage);

  assert.equal(result.ok, false);
  assert.ok(!result.ok); // narrow the union
  assert.equal(result.reason, "parse_failed");
  assert.ok(result.message.length > 0);
});

test("empty buffer: parse_failed, no throw", async () => {
  const result = await parsePdfAttachment(Buffer.alloc(0));

  assert.equal(result.ok, false);
  assert.ok(!result.ok);
  assert.equal(result.reason, "parse_failed");
});

test("random binary bytes: parse_failed, no throw", async () => {
  const noise = Buffer.alloc(2048);
  for (let i = 0; i < noise.length; i++) noise[i] = Math.floor(Math.random() * 256);

  const result = await parsePdfAttachment(noise);

  assert.equal(result.ok, false);
  assert.ok(!result.ok);
  assert.equal(result.reason, "parse_failed");
});

test("image bytes mislabeled as a PDF: parse_failed, no throw", async () => {
  const png = await readFixture(GREEN_PNG);

  const result = await parsePdfAttachment(png);

  assert.equal(result.ok, false);
  assert.ok(!result.ok);
  assert.equal(result.reason, "parse_failed");
});

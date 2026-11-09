import assert from "node:assert/strict";
import { register } from "node:module";
import { test } from "node:test";
import { pathToFileURL } from "node:url";

register("./mobile-ts-resolve.mjs", pathToFileURL("./tests/"));

const {
  isSupportedAttachment,
  normalizeAttachmentMediaType,
} = await import("../mobile/src/file-attachment-meta.ts");

test("normalizeAttachmentMediaType maps extensions and CSV aliases", () => {
  assert.equal(normalizeAttachmentMediaType("notes.csv", "application/octet-stream"), "text/csv");
  assert.equal(normalizeAttachmentMediaType("notes.csv", "application/csv"), "text/csv");
  assert.equal(normalizeAttachmentMediaType("doc.pdf", undefined), "application/pdf");
  assert.equal(normalizeAttachmentMediaType("data.json", "public.data"), "application/json");
  assert.equal(normalizeAttachmentMediaType("readme.md", undefined), "text/markdown");
});

test("isSupportedAttachment accepts analysis-friendly types", () => {
  assert.equal(isSupportedAttachment("a.pdf", "application/pdf"), true);
  assert.equal(isSupportedAttachment("b.csv", "text/csv"), true);
  assert.equal(isSupportedAttachment("c.txt", "text/plain"), true);
  assert.equal(isSupportedAttachment("d.json", "application/json"), true);
  assert.equal(isSupportedAttachment("e.bin", "application/octet-stream"), false);
});

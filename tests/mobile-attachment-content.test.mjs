import assert from "node:assert/strict";
import { test } from "node:test";
import { createAttachmentMarker, isAttachmentMarker, toEveTurn } from "../mobile/src/attachment-content.ts";

const image = {
  id: "photo-1",
  name: "receipt.jpg",
  type: "image",
  contentType: "image/jpeg",
  status: { type: "complete" },
  content: [{ type: "image", image: "data:image/jpeg;base64,YWJj" }],
};

test("attachment-only markers are unique per send and recognizable on replay", () => {
  const one = createAttachmentMarker();
  const two = createAttachmentMarker();
  assert.notEqual(one, two);
  assert.equal(isAttachmentMarker(one), true);
  assert.equal(isAttachmentMarker("[Attachment]"), false);
});

test("text-only turns stay text-only", () => {
  assert.deepEqual(toEveTurn({ content: [{ type: "text", text: "Hello" }] }), {
    text: "Hello", message: "Hello",
  });
});

test("photo-only and mixed turns send the actual image to eve", () => {
  const file = { type: "file", data: "data:image/jpeg;base64,YWJj", mediaType: "image/jpeg", filename: "receipt.jpg" };
  assert.deepEqual(toEveTurn({ content: [], attachments: [image] }).message, [file]);
  assert.deepEqual(toEveTurn({ content: [{ type: "text", text: "Read this" }], attachments: [image] }).message, [
    { type: "text", text: "Read this" }, file,
  ]);
});

test("PDF extraction becomes text, not an unsupported raw PDF file", () => {
  const result = toEveTurn({
    content: [{ type: "text", text: "Summarize" }],
    attachments: [{ id: "pdf", type: "document", name: "report.pdf", status: { type: "complete" }, content: [{ type: "text", text: "[Attached PDF: report.pdf] Page 1" }] }],
  });
  assert.deepEqual(result.message, [
    { type: "text", text: "Summarize" },
    { type: "text", text: "[Attached PDF: report.pdf] Page 1" },
  ]);
});

test("incomplete, oversized or empty attachments cannot masquerade as sent", () => {
  assert.throws(() => toEveTurn({ content: [], attachments: [{ ...image, status: { type: "incomplete", reason: "error" } }] }), /not ready/);
  assert.throws(() => toEveTurn({ content: [], attachments: [{ ...image, content: [] }] }), /no content/);
  assert.throws(() => toEveTurn({ content: [], attachments: [{ ...image, content: [{ type: "image", image: "x".repeat(2_800_001) }] }] }), /too large together/);
});

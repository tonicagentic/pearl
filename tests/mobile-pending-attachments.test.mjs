import assert from "node:assert/strict";
import { register } from "node:module";
import { test } from "node:test";
import { pathToFileURL } from "node:url";

register("./mobile-ts-resolve.mjs", pathToFileURL("./tests/"));

const {
  appendPendingAttachment,
  chatAttachmentKey,
  clearPendingAttachments,
  getPendingAttachments,
  removePendingAttachment,
  setPendingAttachments,
  PENDING_ATTACHMENTS_DRAFT_KEY,
} = await import("../mobile/src/pending-attachments.ts");

test("pending attachments persist per chat and clear only when asked", () => {
  const key = chatAttachmentKey("chat-1");
  clearPendingAttachments(key);
  clearPendingAttachments(PENDING_ATTACHMENTS_DRAFT_KEY);

  appendPendingAttachment(key, {
    name: "a.pdf",
    contentType: "application/pdf",
    type: "document",
    content: [{ type: "text", text: "[Attached PDF: a.pdf]" }],
  });
  assert.equal(getPendingAttachments(key).length, 1);
  assert.equal(getPendingAttachments(PENDING_ATTACHMENTS_DRAFT_KEY).length, 0);

  setPendingAttachments(key, [
    ...getPendingAttachments(key),
    {
      name: "b.csv",
      contentType: "text/csv",
      type: "document",
      content: [{ type: "text", text: "a,b\n1,2" }],
    },
  ]);
  assert.equal(getPendingAttachments(key).length, 2);

  removePendingAttachment(key, "a.pdf", "application/pdf");
  assert.equal(getPendingAttachments(key).length, 1);
  assert.equal(getPendingAttachments(key)[0].name, "b.csv");

  clearPendingAttachments(key);
  assert.equal(getPendingAttachments(key).length, 0);
});

test("null chat id maps to the draft key", () => {
  assert.equal(chatAttachmentKey(null), PENDING_ATTACHMENTS_DRAFT_KEY);
  assert.equal(chatAttachmentKey(undefined), PENDING_ATTACHMENTS_DRAFT_KEY);
});

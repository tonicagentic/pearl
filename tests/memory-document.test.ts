import assert from "node:assert/strict";
import { test } from "node:test";

import {
  applyMemoryOp,
  emptyMemoryFile,
  formatMemoryDocument,
  MAX_ENTRY_BYTES,
  MemoryInputError,
  parseMemoryDocument,
  recallCharacterCount,
} from "../lib/memory/file-document.ts";

test("format and parse round-trip indexed memories", () => {
  const saved = applyMemoryOp(emptyMemoryFile(), {
    type: "add",
    text: "  Likes   short replies. ",
  });
  const both = applyMemoryOp(saved.file, {
    type: "add",
    text: "Lives in Berlin.",
  });
  const content = formatMemoryDocument(both.file);
  assert.equal(
    content,
    [
      "<!-- eve-memory-file-v1 lastAllocatedIndex=1 -->",
      "0: Likes short replies.",
      "1: Lives in Berlin.",
      "",
    ].join("\n"),
  );
  assert.deepEqual(parseMemoryDocument(content), both.file);
});

test("add is a no-op when the normalized text is already saved", () => {
  const saved = applyMemoryOp(emptyMemoryFile(), {
    type: "add",
    text: "Prefers brief emails",
  });
  const again = applyMemoryOp(saved.file, {
    type: "add",
    text: "  Prefers   brief emails ",
  });
  assert.equal(again.changed, false);
  assert.equal(again.notice, "duplicate");
  assert.equal(again.file.lastAllocatedIndex, 0);
  assert.equal(again.file.entries.length, 1);
});

test("remove keeps the allocated index so the next save does not reuse it", () => {
  const saved = applyMemoryOp(emptyMemoryFile(), {
    type: "add",
    text: "First fact",
  });
  const removed = applyMemoryOp(saved.file, { type: "remove", index: 0 });
  assert.equal(removed.changed, true);
  assert.equal(removed.file.entries.length, 0);
  assert.equal(removed.file.lastAllocatedIndex, 0);
  const next = applyMemoryOp(removed.file, { type: "add", text: "Second fact" });
  assert.equal(next.file.entries[0]?.index, 1);
  assert.equal(next.file.lastAllocatedIndex, 1);
});

test("update rewrites one line and rejects a duplicate of another", () => {
  const first = applyMemoryOp(emptyMemoryFile(), { type: "add", text: "Alpha" });
  const second = applyMemoryOp(first.file, { type: "add", text: "Beta" });
  const updated = applyMemoryOp(second.file, {
    type: "update",
    index: 0,
    text: "Alpha revised",
  });
  assert.equal(updated.file.entries[0]?.text, "Alpha revised");
  assert.equal(updated.file.entries[0]?.index, 0);
  assert.throws(
    () =>
      applyMemoryOp(updated.file, {
        type: "update",
        index: 0,
        text: "Beta",
      }),
    (error: unknown) =>
      error instanceof MemoryInputError &&
      error.message === "That memory is already saved.",
  );
});

test("clear drops entries and keeps the header index", () => {
  const saved = applyMemoryOp(emptyMemoryFile(), { type: "add", text: "Alpha" });
  const cleared = applyMemoryOp(saved.file, { type: "clear" });
  assert.equal(formatMemoryDocument(cleared.file), "<!-- eve-memory-file-v1 lastAllocatedIndex=0 -->\n");
  assert.equal(applyMemoryOp(cleared.file, { type: "clear" }).changed, false);
});

test("rejects empty text and overlong entries", () => {
  assert.throws(
    () => applyMemoryOp(emptyMemoryFile(), { type: "add", text: "   \n  " }),
    MemoryInputError,
  );
  assert.throws(
    () =>
      applyMemoryOp(emptyMemoryFile(), {
        type: "add",
        text: "a".repeat(MAX_ENTRY_BYTES + 1),
      }),
    /2,048-byte limit/,
  );
});

test("rejects a save that would overflow the recall budget", () => {
  let file = emptyMemoryFile();
  let added = 0;
  for (; added < 100; ) {
    try {
      const next = applyMemoryOp(file, {
        type: "add",
        text: `${"word ".repeat(40)}${added}`,
      });
      file = next.file;
      added += 1;
    } catch (error) {
      assert.ok(error instanceof MemoryInputError);
      assert.match(error.message, /4,000-character limit/);
      assert.ok(added > 0);
      assert.ok(recallCharacterCount(file.entries) <= 4000);
      return;
    }
  }
  assert.fail("recall limit was never reached");
});

test("rejects a document eve would not parse", () => {
  assert.throws(
    () => parseMemoryDocument("0: missing header\n"),
    /invalid versioned memory document/,
  );
  assert.throws(
    () =>
      parseMemoryDocument(
        "<!-- eve-memory-file-v1 lastAllocatedIndex=0 -->\n0: trailing space \n",
      ),
    /invalid versioned memory document/,
  );
});

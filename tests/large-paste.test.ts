import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createPasteEntry,
  expandPastesForSend,
  formatCount,
  LARGE_PASTE_CHARS,
  LARGE_PASTE_MAX_CHARS,
  pasteBlockStart,
  splitPasteBlocks,
} from "../lib/chat/large-paste.ts";

function longText(chars: number, suffix = ""): string {
  return "x".repeat(chars) + suffix;
}

test("createPasteEntry names pastes in registration order", () => {
  const first = createPasteEntry(1, longText(LARGE_PASTE_CHARS));
  const second = createPasteEntry(2, longText(LARGE_PASTE_CHARS));

  assert.deepEqual(first, { id: "paste-1", charCount: LARGE_PASTE_CHARS });
  assert.equal(second.id, "paste-2");
});

test("expandPastesForSend appends paste blocks after the composer text", () => {
  const { text, consumedIds } = expandPastesForSend(
    "Summarize the pasted log.",
    [{ id: "paste-1", content: "LOG LINE\nLOG LINE", charCount: 5400 }],
  );

  assert.ok(text.startsWith("Summarize the pasted log.\n\n"));
  assert.ok(text.includes(pasteBlockStart("paste-1", 5400)));
  assert.ok(text.includes("LOG LINE\nLOG LINE"));
  assert.ok(text.includes("[end paste-1]"));
  assert.deepEqual(consumedIds, ["paste-1"]);
});

test("expandPastesForSend works for a paste-only message (empty composer text)", () => {
  const { text } = expandPastesForSend("", [
    { id: "paste-2", content: "content", charCount: 2000 },
  ]);

  // no leading separator when the composer text is empty
  assert.ok(text.startsWith(pasteBlockStart("paste-2", 2000)));
  assert.ok(text.endsWith("[end paste-2]"));
});

test("expandPastesForSend orders multiple pastes by registration", () => {
  const { text, consumedIds } = expandPastesForSend("Question?", [
    { id: "paste-1", content: "first", charCount: 1500 },
    { id: "paste-2", content: "second", charCount: 2500 },
  ]);

  assert.ok(text.indexOf("[pasted text paste-1") < text.indexOf("[pasted text paste-2"));
  assert.ok(text.indexOf("[end paste-1]") < text.indexOf("[pasted text paste-2"));
  assert.deepEqual(consumedIds, ["paste-1", "paste-2"]);
});

test("expandPastesForSend is a no-op with no held pastes", () => {
  const { text, consumedIds } = expandPastesForSend("just a question", []);

  assert.equal(text, "just a question");
  assert.deepEqual(consumedIds, []);
});

test("splitPasteBlocks separates paste blocks from literal text", () => {
  const { text } = expandPastesForSend("Before.", [
    { id: "paste-1", content: "line one\nline two", charCount: 4200 },
  ]);

  const segments = splitPasteBlocks(text);

  // separator text, then the appended paste block at the end
  assert.equal(segments.length, 2);
  assert.equal(segments[0].kind, "text");
  assert.ok(segments[0].kind === "text" && segments[0].text.startsWith("Before."));

  const paste = segments[1];
  assert.equal(paste.kind, "paste");
  if (paste.kind === "paste") {
    assert.equal(paste.id, "paste-1");
    assert.equal(paste.charCount, 4200);
    assert.equal(paste.content, "line one\nline two");
  }
});

test("splitPasteBlocks round-trips multiple blocks and preserves text exactly", () => {
  const { text } = expandPastesForSend("a", [
    { id: "paste-1", content: "first paste", charCount: 1500 },
    { id: "paste-2", content: "second\npaste", charCount: 2500 },
  ]);

  const segments = splitPasteBlocks(text);
  const pastes = segments.filter((s) => s.kind === "paste");
  assert.equal(pastes.length, 2);

  const rejoined = segments
    .map((s) =>
      s.kind === "paste"
        ? `${pasteBlockStart(s.id, s.charCount)}\n${s.content}\n[end ${s.id}]`
        : s.text,
    )
    .join("");

  assert.equal(rejoined, text);
});

test("splitPasteBlocks leaves malformed or partial markers as literal text", () => {
  const segments = splitPasteBlocks(
    "here [pasted text paste-9 · 1,000 characters] with no end marker",
  );

  // the prefix before the malformed header is its own text segment
  assert.equal(segments.length, 2);
  if (segments[0].kind === "text") {
    assert.equal(segments[0].text, "here ");
  }
  if (segments[1].kind === "text") {
    assert.ok(segments[1].text.startsWith("[pasted text"));
  }
});

test("splitPasteBlocks returns one text segment for paste-free messages", () => {
  const segments = splitPasteBlocks("just a normal message");

  assert.deepEqual(segments, [{ kind: "text", text: "just a normal message" }]);
});

test("limits: threshold is sane and the cap keeps pastes inside the model context budget", () => {
  assert.ok(LARGE_PASTE_CHARS >= 500);
  // ~4 chars/token -> 400k chars is ~100k tokens, well under 1M.
  assert.ok(LARGE_PASTE_MAX_CHARS <= 500_000);
  assert.ok(LARGE_PASTE_MAX_CHARS > LARGE_PASTE_CHARS);
});

test("formatCount groups digits", () => {
  assert.equal(formatCount(4321), "4,321");
  assert.equal(formatCount(999), "999");
});

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createAttachedPaste,
  expandLargePastes,
  findPlaceholderIds,
  formatCount,
  LARGE_PASTE_CHARS,
  makePastePlaceholder,
} from "../lib/chat/large-paste.ts";

function longText(chars: number, suffix = ""): string {
  return "x".repeat(chars) + suffix;
}

test("createAttachedPaste returns null for small pastes (normal insert)", () => {
  const result = createAttachedPaste({
    composerText: "",
    selectionStart: 0,
    selectionEnd: 0,
    pastedText: "short text",
    nextIndex: 1,
  });

  assert.equal(result, null);
});

test("createAttachedPaste attaches at the threshold and composes placeholder text", () => {
  const pasted = longText(LARGE_PASTE_CHARS);
  const result = createAttachedPaste({
    composerText: "Check this: ",
    selectionStart: 12,
    selectionEnd: 12,
    pastedText: pasted,
    nextIndex: 3,
  });

  assert.ok(result);
  assert.equal(result.id, "paste-3");
  assert.equal(result.placeholder, makePastePlaceholder("paste-3", LARGE_PASTE_CHARS));
  assert.equal(result.composerText, `Check this: ${result.placeholder}`);
  assert.equal(result.content, pasted);
});

test("createAttachedPaste replaces the selection and keeps surrounding text", () => {
  const result = createAttachedPaste({
    composerText: "before middle after",
    selectionStart: 7,
    selectionEnd: 13,
    pastedText: longText(LARGE_PASTE_CHARS),
    nextIndex: 1,
  });

  assert.ok(result);
  assert.ok(result.composerText.startsWith("before "));
  assert.ok(result.composerText.endsWith(" after"));
  assert.ok(result.composerText.includes(result.placeholder));
});

test("expandLargePastes expands registered placeholders into inline blocks", () => {
  const placeholder = makePastePlaceholder("paste-1", 4200);
  const registry = new Map([
    [
      "paste-1",
      {
        id: "paste-1",
        placeholder,
        content: "line one\nline two\n\n",
        charCount: 4200,
      },
    ],
  ]);

  const { text, removedIds } = expandLargePastes(
    `See the log below.\n${placeholder}\n\nAnd the summary question.`,
    registry,
  );

  assert.ok(text.includes("[pasted text paste-1 · 4,200 characters]"));
  assert.ok(text.includes("line one\nline two"));
  assert.ok(text.includes("[end paste-1]"));
  // the trailing blank line of the content is trimmed into the block
  assert.ok(text.includes("line two\n[end paste-1]"));
  assert.deepEqual(removedIds, []);
});

test("expandLargePastes reports entries whose placeholder was deleted", () => {
  const placeholder = makePastePlaceholder("paste-2", 2000);
  const registry = new Map([
    ["paste-2", { id: "paste-2", placeholder, content: "a", charCount: 2000 }],
    [
      "paste-3",
      {
        id: "paste-3",
        placeholder: makePastePlaceholder("paste-3", 3000),
        content: "b",
        charCount: 3000,
      },
    ],
  ]);

  // Only paste-3's placeholder remains in the composer text.
  const { text, removedIds } = expandLargePastes(
    `keep this ${makePastePlaceholder("paste-3", 3000)}`,
    registry,
  );

  assert.deepEqual(removedIds, ["paste-2"]);
  assert.ok(text.includes("b"));
  assert.ok(!text.includes(placeholder));
});

test("findPlaceholderIds matches several pastes and ignores unknown text", () => {
  const text = [
    "before",
    makePastePlaceholder("paste-1", 1500),
    makePastePlaceholder("paste-12", 25000),
    "not [Pasted text #7 +1,000 chars] a real placeholder",
  ].join("\n");

  assert.deepEqual(findPlaceholderIds(text), ["paste-1", "paste-12"]);
});

test("expandLargePastes handles repeated placeholders in one text", () => {
  const placeholder = makePastePlaceholder("paste-4", 1300);
  const registry = new Map([
    ["paste-4", { id: "paste-4", placeholder, content: "CONTENT", charCount: 1300 }],
  ]);

  const { text } = expandLargePastes(`${placeholder} then ${placeholder}`, registry);

  assert.equal(text.split("[end paste-4]").length - 1, 2);
});

test("formatCount groups digits", () => {
  assert.equal(formatCount(4321), "4,321");
  assert.equal(formatCount(999), "999");
});

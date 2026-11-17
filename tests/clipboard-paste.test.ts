import assert from "node:assert/strict";
import { test } from "node:test";

import {
  composerMustHandlePaste,
  htmlClipboardToText,
  nameClipboardFile,
  normalizeClipboardText,
  readClipboardPaste,
} from "../lib/chat/clipboard-paste.ts";
import { LARGE_PASTE_CHARS } from "../lib/chat/large-paste.ts";

type StubItem = {
  kind: string;
  type: string;
  getAsFile: () => File | null;
};

function stubDataTransfer(args: {
  files?: File[];
  items?: StubItem[];
  data?: Record<string, string>;
}): DataTransfer {
  const files = args.files ?? [];
  const items = args.items ?? [];
  const data = args.data ?? {};
  return {
    files: files as unknown as FileList,
    items: items as unknown as DataTransferItemList,
    getData: (type: string) => data[type] ?? "",
  } as DataTransfer;
}

test("readClipboardPaste collects item-only images and renames them", () => {
  const blob = new File([new Uint8Array([1, 2, 3])], "image.png", {
    type: "image/png",
  });
  const payload = readClipboardPaste(
    stubDataTransfer({
      items: [
        {
          kind: "file",
          type: "image/png",
          getAsFile: () => blob,
        },
      ],
    }),
  );

  assert.equal(payload.files.length, 1);
  assert.equal(payload.files[0]?.name, "pasted-image.png");
  assert.equal(payload.files[0]?.type, "image/png");
  assert.equal(payload.text, "");
  assert.equal(composerMustHandlePaste(payload, LARGE_PASTE_CHARS), true);
});

test("readClipboardPaste keeps files when short text is also present", () => {
  const file = new File([new Uint8Array([9])], "note.txt", {
    type: "text/plain",
  });
  const payload = readClipboardPaste(
    stubDataTransfer({
      files: [file],
      data: { "text/plain": "please summarize" },
    }),
  );

  assert.equal(payload.files.length, 1);
  assert.equal(payload.files[0]?.name, "note.txt");
  assert.equal(payload.text, "please summarize");
  assert.equal(composerMustHandlePaste(payload, LARGE_PASTE_CHARS), true);
});

test("readClipboardPaste falls back from HTML when plain text is empty", () => {
  const payload = readClipboardPaste(
    stubDataTransfer({
      data: {
        "text/plain": "",
        "text/html": "<p>Hello&nbsp;<b>world</b></p>",
      },
    }),
  );

  assert.equal(payload.files.length, 0);
  assert.equal(payload.text, "Hello world");
  assert.equal(composerMustHandlePaste(payload, LARGE_PASTE_CHARS), false);
});

test("readClipboardPaste falls back to uri-list", () => {
  const payload = readClipboardPaste(
    stubDataTransfer({
      data: {
        "text/uri-list": "# comment\nhttps://example.com/a\nhttps://example.com/b\n",
      },
    }),
  );

  assert.equal(payload.text, "https://example.com/a\nhttps://example.com/b");
});

test("long text still requires composer handling and keeps files", () => {
  const file = new File([new Uint8Array([1])], "shot.png", {
    type: "image/png",
  });
  const long = "x".repeat(LARGE_PASTE_CHARS);
  const payload = readClipboardPaste(
    stubDataTransfer({
      files: [file],
      items: [
        {
          kind: "file",
          type: "image/png",
          getAsFile: () => file,
        },
      ],
      data: { "text/plain": long },
    }),
  );

  // Deduped across files + items.
  assert.equal(payload.files.length, 1);
  assert.equal(payload.text.length, LARGE_PASTE_CHARS);
  assert.equal(composerMustHandlePaste(payload, LARGE_PASTE_CHARS), true);
});

test("nameClipboardFile leaves real filenames alone", () => {
  const file = new File([new Uint8Array([1])], "deploy.png", {
    type: "image/png",
  });
  assert.equal(nameClipboardFile(file, 0).name, "deploy.png");
});

test("htmlClipboardToText strips tags without a DOMParser", () => {
  const text = htmlClipboardToText("<div>Line one<br/>Line two</div>");
  assert.match(text, /Line one/);
  assert.match(text, /Line two/);
});

test("normalizeClipboardText prefers plain then HTML then URL", () => {
  assert.equal(
    normalizeClipboardText({
      text: " plain ",
      html: "<p>x</p>",
      url: "https://example.com",
    }),
    "plain",
  );
  assert.equal(
    normalizeClipboardText({ text: "", html: "<p>Hi&nbsp;there</p>" }),
    "Hi there",
  );
  assert.equal(
    normalizeClipboardText({ text: "", html: "", url: " https://x.test " }),
    "https://x.test",
  );
});

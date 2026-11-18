import assert from "node:assert/strict";
import { test } from "node:test";

import {
  writeFileContentFromArgs,
  writeFilePathFromArgs,
} from "../mobile/src/write-file-args.ts";

test("writeFilePathFromArgs prefers settled args", () => {
  assert.equal(
    writeFilePathFromArgs({ filePath: "docs/a.md" }, '{"filePath":"other.md"'),
    "docs/a.md",
  );
});

test("writeFilePathFromArgs reads streaming argsText", () => {
  assert.equal(
    writeFilePathFromArgs(
      {},
      '{"filePath":"docs/mobile-canvas.md","content":"# Hi',
    ),
    "docs/mobile-canvas.md",
  );
});

test("writeFileContentFromArgs returns partial streaming content", () => {
  const content = writeFileContentFromArgs(
    {},
    '{"filePath":"a.md","content":"# Title\\n\\nHello',
  );
  assert.equal(content, "# Title\n\nHello");
});

test("writeFileContentFromArgs returns full settled content", () => {
  assert.equal(
    writeFileContentFromArgs({ content: "done" }, undefined),
    "done",
  );
});

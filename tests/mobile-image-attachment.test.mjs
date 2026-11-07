import assert from "node:assert/strict";
import { test } from "node:test";
import { dataUrlToBytes } from "../mobile/src/image-bytes.ts";

test("dataUrlToBytes decodes a jpeg data URL", () => {
  // "abc" in base64
  const bytes = dataUrlToBytes("data:image/jpeg;base64,YWJj");
  assert.deepEqual([...bytes], [97, 98, 99]);
});

test("dataUrlToBytes rejects non-base64 payloads", () => {
  assert.throws(() => dataUrlToBytes("data:image/jpeg,not-base64"), /base64/);
  assert.throws(() => dataUrlToBytes("https://example.com/x.jpg"), /data URL/);
});

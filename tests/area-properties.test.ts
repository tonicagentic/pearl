import assert from "node:assert/strict";
import { test } from "node:test";

import { formatPropertyValue, parsePropertyValue, validateAreaProperties } from "../lib/area-properties.ts";

test("property values round trip as JSON, including strings", () => {
  for (const value of ["42", 42, true, null, [1, "two"], { nested: { ok: true } }]) {
    assert.deepEqual(parsePropertyValue(formatPropertyValue(value)), value);
  }
  assert.equal(parsePropertyValue("unquoted text"), "unquoted text");
  assert.throws(() => parsePropertyValue('{broken'), /valid JSON/);
});

test("properties require a bounded JSON object", () => {
  assert.deepEqual(validateAreaProperties({ nickname: "home", count: 2 }), { nickname: "home", count: 2 });
  assert.throws(() => validateAreaProperties([]), /JSON object/);
  assert.throws(() => validateAreaProperties({ "": 1 }), /named properties/);
  assert.throws(() => validateAreaProperties({ bad: undefined }), /valid JSON/);
  assert.throws(() => validateAreaProperties({ large: "x".repeat(17_000) }), /smaller than/);
  assert.throws(() => validateAreaProperties(JSON.parse('{"__proto__":true}')), /named properties/);
});

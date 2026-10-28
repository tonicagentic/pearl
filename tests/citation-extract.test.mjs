import assert from "node:assert/strict";
import test from "node:test";

// Mirror the extractor without TS imports so the unit suite stays dependency-light.
const CITATION_LINK_RE =
  /\[(\d+)\]\((https?:\/\/[^\s)]+)(?:\s+"([^"]*)")?\)/g;

function extractCitationRefs(markdown) {
  const seen = new Set();
  const refs = [];
  for (const match of markdown.matchAll(CITATION_LINK_RE)) {
    const index = match[1];
    const url = match[2];
    const title = match[3]?.trim() || undefined;
    if (!index || !url || seen.has(index)) continue;
    seen.add(index);
    refs.push(title ? { index, url, title } : { index, url });
  }
  return refs.sort((a, b) => Number(a.index) - Number(b.index));
}

test("extracts numbered citations in order and dedupes by index", () => {
  const markdown = `Alpha [2](https://b.example "B") and [1](https://a.example). Again [1](https://a.example/other).`;
  assert.deepEqual(extractCitationRefs(markdown), [
    { index: "1", url: "https://a.example" },
    { index: "2", url: "https://b.example", title: "B" },
  ]);
});

test("ignores non-http and bare links", () => {
  assert.deepEqual(
    extractCitationRefs(`See [docs](https://example.com) and [1](file:///tmp/x)`),
    [],
  );
});

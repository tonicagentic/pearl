import assert from "node:assert/strict";
import { test } from "node:test";

import {
  MAX_QUOTE_LENGTH,
  findQuoteSpan,
  requireQuoteText,
} from "../lib/library/quote-text.ts";

test("requireQuoteText trims and returns text", () => {
  assert.equal(requireQuoteText("  hello insight  "), "hello insight");
});

test("requireQuoteText rejects empty and whitespace", () => {
  assert.throws(() => requireQuoteText(""), /Select some text/);
  assert.throws(() => requireQuoteText("   \n\t  "), /Select some text/);
});

test("requireQuoteText rejects overlong text", () => {
  const long = "a".repeat(MAX_QUOTE_LENGTH + 1);
  assert.throws(() => requireQuoteText(long), /8,000 characters/);
  assert.equal(
    requireQuoteText("a".repeat(MAX_QUOTE_LENGTH)).length,
    MAX_QUOTE_LENGTH,
  );
});

test("findQuoteSpan matches a single-line selection", () => {
  const haystack = "Hello world, this is a quote.";
  const span = findQuoteSpan(haystack, "this is a quote");
  assert.deepEqual(span, { start: 13, end: 28 });
  assert.equal(haystack.slice(span!.start, span!.end), "this is a quote");
});

test("findQuoteSpan matches across paragraph breaks", () => {
  const haystack = "First paragraph.\n\nSecond paragraph here.";
  const span = findQuoteSpan(haystack, "First paragraph. Second paragraph");
  assert.ok(span);
  assert.equal(
    haystack.slice(span!.start, span!.end).replace(/\s+/g, " "),
    "First paragraph. Second paragraph",
  );
});

test("findQuoteSpan returns null when there is no match", () => {
  assert.equal(findQuoteSpan("Hello world", "goodbye"), null);
  assert.equal(findQuoteSpan("Hello world", ""), null);
  assert.equal(findQuoteSpan("", "hello"), null);
});

test("findQuoteSpan ignores surrounding whitespace on the needle", () => {
  const haystack = "alpha beta gamma";
  const span = findQuoteSpan(haystack, "  beta  ");
  assert.deepEqual(span, { start: 6, end: 10 });
});

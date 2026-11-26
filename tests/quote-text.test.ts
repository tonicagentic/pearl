import assert from "node:assert/strict";
import { test } from "node:test";

import {
  MAX_QUOTE_LENGTH,
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

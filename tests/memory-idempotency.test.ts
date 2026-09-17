import assert from "node:assert/strict";
import { test } from "node:test";
import { isDuplicate, jaccardSimilarity, normalizeText } from "../lib/testing/similarity.ts";

// Part 1 (write amplification): the dedupe contract memory writes are scored
// against. Exact and normalized-text dedupe at minimum, near-dupes via
// word-bag Jaccard.

test("normalizeText: case, whitespace, possessives, punctuation (keeps path separators)", () => {
  assert.equal(
    normalizeText("  The User's   TIMEZONE is Pacific/Auckland. "),
    "the user timezone is pacific/auckland",
  );
  assert.equal(normalizeText("Prefers brief emails!!"), "prefers brief emails");
});

test("isDuplicate: exact match", () => {
  assert.equal(isDuplicate("User prefers brief emails", ["User prefers brief emails"]), true);
});

test("isDuplicate: normalized match (case/whitespace/punctuation differences)", () => {
  assert.equal(
    isDuplicate("User prefers brief emails.", ["user prefers    brief EMAILS"]),
    true,
  );
});

test("isDuplicate: near-duplicate paraphrase above threshold", () => {
  assert.equal(
    isDuplicate(
      "User's timezone is Pacific/Auckland",
      ["User's timezone is Pacific/Auckland (NZT)"],
    ),
    true,
  );
  assert.equal(
    isDuplicate(
      "User prefers brief emails",
      ["User prefers short brief emails"],
    ),
    true,
  );
});

test("isDuplicate: distinct facts are not duplicates", () => {
  assert.equal(
    isDuplicate("User prefers brief emails", ["User's timezone is Pacific/Auckland"]),
    false,
  );
});

test("isDuplicate: empty ledger never matches", () => {
  assert.equal(isDuplicate("anything", []), false);
});

test("jaccardSimilarity: identical bags, disjoint bags, empty inputs", () => {
  assert.equal(jaccardSimilarity("a b c", "a b c"), 1);
  assert.equal(jaccardSimilarity("a b c", "d e f"), 0);
  assert.equal(jaccardSimilarity("", ""), 1);
  assert.equal(jaccardSimilarity("a", ""), 0);
});

// The write-amplification contract a scripted session is scored against:
// replaying the same save must not grow the ledger.
test("simulated memory ledger: idempotent writes keep one entry per fact", () => {
  const ledger: string[] = [];
  const save = (entry: string) => {
    if (!isDuplicate(entry, ledger)) ledger.push(entry);
  };

  save("User's timezone is Pacific/Auckland");
  save("User's timezone is Pacific/Auckland."); // exact modulo punctuation
  save("user timezone: pacific/auckland"); // near-duplicate
  save("User prefers brief emails"); // genuinely new

  assert.equal(ledger.length, 2);
});

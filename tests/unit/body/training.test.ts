import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isTrainingDay,
  parseTrainingDays,
  serializeTrainingDays,
  weekdayFromDate,
} from "@/lib/body/training";

describe("parseTrainingDays", () => {
  it("parses a valid JSON array", () => {
    assert.deepEqual(parseTrainingDays("[1,3,5]"), [1, 3, 5]);
  });

  it("dedupes and sorts", () => {
    assert.deepEqual(parseTrainingDays("[5,1,5,3]"), [1, 3, 5]);
  });

  it("filters invalid values", () => {
    assert.deepEqual(parseTrainingDays('[1,7,-1,3.5,"x",2]'), [1, 2]);
  });

  it("returns empty for bad JSON", () => {
    assert.deepEqual(parseTrainingDays("not-json"), []);
    assert.deepEqual(parseTrainingDays(null), []);
  });
});

describe("serializeTrainingDays", () => {
  it("round-trips cleaned days", () => {
    assert.equal(serializeTrainingDays([5, 1, 1, 9, 3]), "[1,3,5]");
  });
});

describe("weekdayFromDate", () => {
  it("returns UTC weekday for ISO dates", () => {
    assert.equal(weekdayFromDate("2026-11-17"), 2);
    assert.equal(weekdayFromDate("2026-11-15"), 0);
  });
});

describe("isTrainingDay", () => {
  it("checks weekday against training days", () => {
    assert.equal(isTrainingDay([1, 3, 5], 3), true);
    assert.equal(isTrainingDay([1, 3, 5], 2), false);
  });

  it("accepts JSON string and ISO date", () => {
    assert.equal(isTrainingDay("[2]", "2026-11-17"), true);
    assert.equal(isTrainingDay("[1]", "2026-11-17"), false);
  });
});

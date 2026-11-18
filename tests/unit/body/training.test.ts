import { describe, it, expect } from "vitest";
import {
  isTrainingDay,
  parseTrainingDays,
  serializeTrainingDays,
  weekdayFromDate,
} from "@/lib/body/training";

describe("parseTrainingDays", () => {
  it("parses a valid JSON array", () => {
    expect(parseTrainingDays("[1,3,5]")).toEqual([1, 3, 5]);
  });

  it("dedupes and sorts", () => {
    expect(parseTrainingDays("[5,1,5,3]")).toEqual([1, 3, 5]);
  });

  it("filters invalid values", () => {
    expect(parseTrainingDays('[1,7,-1,3.5,"x",2]')).toEqual([1, 2]);
  });

  it("returns empty for bad JSON", () => {
    expect(parseTrainingDays("not-json")).toEqual([]);
    expect(parseTrainingDays(null)).toEqual([]);
  });
});

describe("serializeTrainingDays", () => {
  it("round-trips cleaned days", () => {
    expect(serializeTrainingDays([5, 1, 1, 9, 3])).toBe("[1,3,5]");
  });
});

describe("weekdayFromDate", () => {
  it("returns UTC weekday for ISO dates", () => {
    expect(weekdayFromDate("2026-11-17")).toBe(2);
    expect(weekdayFromDate("2026-11-15")).toBe(0);
  });
});

describe("isTrainingDay", () => {
  it("checks weekday against training days", () => {
    expect(isTrainingDay([1, 3, 5], 3)).toBe(true);
    expect(isTrainingDay([1, 3, 5], 2)).toBe(false);
  });

  it("accepts JSON string and ISO date", () => {
    expect(isTrainingDay("[2]", "2026-11-17")).toBe(true);
    expect(isTrainingDay("[1]", "2026-11-17")).toBe(false);
  });
});

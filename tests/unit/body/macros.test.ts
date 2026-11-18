import { describe, it, expect } from "vitest";
import {
  EMPTY_MACROS,
  remainingMacros,
  scaleMacros,
  sumMacros,
} from "@/lib/body/macros";

describe("scaleMacros", () => {
  it("scales per-serving macros by servings", () => {
    expect(
      scaleMacros(
        { calories: 100, proteinG: 10, carbsG: 20, fatG: 5 },
        2.5,
      ),
    ).toEqual({ calories: 250, proteinG: 25, carbsG: 50, fatG: 12.5 });
  });

  it("handles zero servings", () => {
    expect(
      scaleMacros(
        { calories: 100, proteinG: 10, carbsG: 20, fatG: 5 },
        0,
      ),
    ).toEqual(EMPTY_MACROS);
  });
});

describe("sumMacros", () => {
  it("sums multiple lines", () => {
    expect(
      sumMacros([
        { calories: 100, proteinG: 10, carbsG: 5, fatG: 2 },
        { calories: 50.5, proteinG: 3.25, carbsG: 1, fatG: 0.5 },
      ]),
    ).toEqual({ calories: 150.5, proteinG: 13.25, carbsG: 6, fatG: 2.5 });
  });

  it("returns empty for no lines", () => {
    expect(sumMacros([])).toEqual(EMPTY_MACROS);
  });
});

describe("remainingMacros", () => {
  it("subtracts logged from target", () => {
    expect(
      remainingMacros(
        { calories: 2000, proteinG: 150, carbsG: 200, fatG: 65 },
        { calories: 500, proteinG: 40, carbsG: 60, fatG: 20 },
      ),
    ).toEqual({ calories: 1500, proteinG: 110, carbsG: 140, fatG: 45 });
  });

  it("can go negative when over target", () => {
    expect(
      remainingMacros(
        { calories: 100, proteinG: 10, carbsG: 10, fatG: 10 },
        { calories: 150, proteinG: 12, carbsG: 8, fatG: 10 },
      ),
    ).toEqual({ calories: -50, proteinG: -2, carbsG: 2, fatG: 0 });
  });
});

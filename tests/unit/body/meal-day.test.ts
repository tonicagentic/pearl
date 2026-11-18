import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  bestServingsForRemaining,
  suggestMealDay,
  type CategorizedFood,
} from "@/lib/body/meal-day";

const steak: CategorizedFood = {
  id: "steak",
  name: "Steak",
  servingLabel: "6 oz",
  slot: "dinner",
  calories: 450,
  proteinG: 40,
  carbsG: 0,
  fatG: 30,
};

const yogurt: CategorizedFood = {
  id: "yogurt",
  name: "Greek yogurt",
  servingLabel: "1 cup",
  slot: "snack",
  calories: 150,
  proteinG: 20,
  carbsG: 8,
  fatG: 4,
};

const oats: CategorizedFood = {
  id: "oats",
  name: "Oatmeal",
  servingLabel: "1 bowl",
  slot: "breakfast",
  calories: 300,
  proteinG: 10,
  carbsG: 50,
  fatG: 6,
};

const chicken: CategorizedFood = {
  id: "chicken",
  name: "Chicken bowl",
  servingLabel: "1 bowl",
  slot: "lunch",
  calories: 500,
  proteinG: 45,
  carbsG: 40,
  fatG: 15,
};

describe("bestServingsForRemaining", () => {
  it("scales servings toward a calorie shortfall", () => {
    const servings = bestServingsForRemaining(yogurt, 300);
    assert.ok(servings >= 1.5);
    assert.ok(servings <= 2);
    assert.ok(yogurt.calories * servings <= 300 * 1.05);
  });

  it("returns 0 when remaining calories are exhausted", () => {
    assert.equal(bestServingsForRemaining(yogurt, 0), 0);
  });
});

describe("suggestMealDay", () => {
  it("keeps steak in dinner and yogurt in snack", () => {
    const suggestion = suggestMealDay({
      foods: [steak, yogurt, oats, chicken],
      remaining: {
        calories: 2200,
        proteinG: 180,
        carbsG: 200,
        fatG: 70,
      },
      loggedSlots: [],
    });

    const dinner = suggestion.slots.find((s) => s.slot === "dinner");
    assert.ok(dinner?.items.some((i) => i.foodId === "steak"));
    assert.ok(
      suggestion.slots.every((s) =>
        s.slot === "dinner"
          ? true
          : s.items.every((i) => i.foodId !== "steak"),
      ),
    );

    const snackOnly = suggestMealDay({
      foods: [steak, yogurt],
      remaining: {
        calories: 400,
        proteinG: 40,
        carbsG: 20,
        fatG: 20,
      },
      loggedSlots: ["breakfast", "lunch", "dinner"],
    });
    const snack = snackOnly.slots.find((s) => s.slot === "snack");
    assert.ok(snack?.items.some((i) => i.foodId === "yogurt"));
    assert.ok(snack?.items.every((i) => i.foodId !== "steak"));
  });

  it("never places dinner-only foods into snack", () => {
    const suggestion = suggestMealDay({
      foods: [steak],
      remaining: {
        calories: 800,
        proteinG: 80,
        carbsG: 0,
        fatG: 40,
      },
      loggedSlots: [],
    });

    const snack = suggestion.slots.find((s) => s.slot === "snack");
    assert.equal(snack, undefined);
    for (const cat of ["breakfast", "lunch", "snack"] as const) {
      assert.ok(
        suggestion.emptyCategories.includes(cat),
        `expected empty ${cat}`,
      );
    }
    assert.ok(suggestion.slots.every((s) => s.slot === "dinner"));
  });

  it("skips already logged slots", () => {
    const suggestion = suggestMealDay({
      foods: [steak, yogurt, oats, chicken],
      remaining: {
        calories: 900,
        proteinG: 80,
        carbsG: 80,
        fatG: 30,
      },
      loggedSlots: ["breakfast", "lunch"],
    });

    assert.deepEqual(suggestion.skippedLoggedSlots, ["breakfast", "lunch"]);
    assert.ok(suggestion.slots.every((s) => s.slot !== "breakfast"));
    assert.ok(suggestion.slots.every((s) => s.slot !== "lunch"));
  });

  it("reports empty categories instead of inventing foods", () => {
    const suggestion = suggestMealDay({
      foods: [yogurt],
      remaining: {
        calories: 1500,
        proteinG: 120,
        carbsG: 100,
        fatG: 40,
      },
      loggedSlots: [],
    });

    for (const cat of ["breakfast", "lunch", "dinner"] as const) {
      assert.ok(
        suggestion.emptyCategories.includes(cat),
        `expected empty ${cat}`,
      );
    }
    assert.ok(suggestion.slots.some((s) => s.slot === "snack"));
  });
});

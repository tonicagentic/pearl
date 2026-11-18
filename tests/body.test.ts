import assert from "node:assert/strict";
import { test } from "node:test";

import {
  parseBodyGrocery,
  parseBodyMealPlan,
  parseBodySession,
  parseBodySettings,
} from "../lib/body/validate.ts";

const settings = {
  goal: "build" as const,
  dietStyle: "high-protein" as const,
  trainingDays: [1, 3, 5],
  split: "push-pull-legs" as const,
  calorieTarget: 2800,
  proteinTarget: 180,
  targetWeight: "185 lb",
};

test("parseBodySettings accepts a valid settings object", () => {
  assert.deepEqual(parseBodySettings(settings), settings);
});

test("parseBodySettings rejects empty training days", () => {
  assert.throws(
    () => parseBodySettings({ ...settings, trainingDays: [] }),
    /trainingDays/,
  );
});

test("parseBodySession rejects sets of 0", () => {
  assert.throws(
    () =>
      parseBodySession({
        date: "2026-11-18",
        splitDayId: "push",
        splitDayLabel: "Push",
        muscleGroups: ["chest", "shoulders", "triceps"],
        exercises: [
          {
            name: "Bench press",
            muscleGroup: "chest",
            sets: 0,
            reps: 8,
            weight: 135,
          },
        ],
        notes: null,
      }),
    /sets/,
  );
});

test("parseBodyMealPlan and parseBodyGrocery accept a week date", () => {
  const plan = parseBodyMealPlan({
    weekStart: "2026-11-16",
    days: [
      {
        date: "2026-11-16",
        meals: [
          {
            slot: "breakfast",
            recipeId: "oats",
            name: "Oats",
            calories: 400,
            protein: 20,
            scale: 1,
          },
        ],
      },
    ],
  });
  assert.equal(plan.weekStart, "2026-11-16");
  assert.equal(plan.days[0]?.date, "2026-11-16");

  const grocery = parseBodyGrocery({
    weekStart: "2026-11-16",
    items: [
      {
        id: "oats",
        name: "Rolled oats",
        amount: "1 kg",
        aisle: "Grains",
        checked: false,
      },
    ],
  });
  assert.equal(grocery.weekStart, "2026-11-16");
  assert.equal(grocery.items[0]?.checked, false);
});

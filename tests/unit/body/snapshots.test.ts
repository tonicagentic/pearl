import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { snapshotFromFood, snapshotsFromPlannedItems } from "@/lib/body/snapshots";

const chicken = {
  id: "food-1",
  name: "Chicken breast",
  calories: 165,
  proteinG: 31,
  carbsG: 0,
  fatG: 3.6,
};

describe("snapshotFromFood", () => {
  it("freezes name and scaled macros", () => {
    const snap = snapshotFromFood(chicken, 2);
    assert.equal(snap.foodId, "food-1");
    assert.equal(snap.name, "Chicken breast");
    assert.equal(snap.servings, 2);
    assert.equal(snap.calories, 330);
    assert.equal(snap.proteinG, 62);
    assert.equal(snap.carbsG, 0);
    assert.equal(snap.fatG, 7.2);
  });

  it("does not mutate the source food when servings change later", () => {
    const snap = snapshotFromFood(chicken, 1);
    const foodLater = { ...chicken, calories: 999, name: "Changed" };
    assert.equal(snap.calories, 165);
    assert.equal(snap.name, "Chicken breast");
    assert.equal(foodLater.calories, 999);
  });
});

describe("snapshotsFromPlannedItems", () => {
  it("maps planned items through food snapshots", () => {
    const snaps = snapshotsFromPlannedItems([
      { foodId: chicken.id, servings: 1.5, food: chicken },
      {
        foodId: "food-2",
        servings: "2",
        food: {
          id: "food-2",
          name: "Rice",
          calories: 100,
          proteinG: 2,
          carbsG: 22,
          fatG: 0,
        },
      },
    ]);
    assert.equal(snaps.length, 2);
    assert.equal(snaps[0].calories, 247.5);
    assert.equal(snaps[0].proteinG, 46.5);
    assert.equal(snaps[1].name, "Rice");
    assert.equal(snaps[1].calories, 200);
    assert.equal(snaps[1].carbsG, 44);
  });
});

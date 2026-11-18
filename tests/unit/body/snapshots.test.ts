import { describe, it, expect } from "vitest";
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
    expect(snap.foodId).toBe("food-1");
    expect(snap.name).toBe("Chicken breast");
    expect(snap.servings).toBe(2);
    expect(snap.calories).toBe(330);
    expect(snap.proteinG).toBe(62);
    expect(snap.carbsG).toBe(0);
    expect(snap.fatG).toBe(7.2);
  });

  it("does not mutate the source food when servings change later", () => {
    const snap = snapshotFromFood(chicken, 1);
    const foodLater = { ...chicken, calories: 999, name: "Changed" };
    expect(snap.calories).toBe(165);
    expect(snap.name).toBe("Chicken breast");
    expect(foodLater.calories).toBe(999);
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
    expect(snaps).toHaveLength(2);
    expect(snaps[0].calories).toBe(247.5);
    expect(snaps[0].proteinG).toBe(46.5);
    expect(snaps[1].name).toBe("Rice");
    expect(snaps[1].calories).toBe(200);
    expect(snaps[1].carbsG).toBe(44);
  });
});

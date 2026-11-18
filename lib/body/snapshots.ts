import { scaleMacros, type MacroTotals } from "@/lib/body/macros";

export type FoodSnapshotSource = {
  id: string;
  name: string;
  calories: number | string;
  proteinG: number | string;
  carbsG: number | string;
  fatG: number | string;
};

export type MealLogItemSnapshot = {
  foodId: string;
  name: string;
  servings: number;
} & MacroTotals;

/**
 * Build a meal-log item snapshot from a food library row and servings.
 * Macros are scaled and frozen so later food edits do not rewrite history.
 */
export function snapshotFromFood(
  food: FoodSnapshotSource,
  servings: number,
): MealLogItemSnapshot {
  const macros = scaleMacros(
    {
      calories: Number(food.calories),
      proteinG: Number(food.proteinG),
      carbsG: Number(food.carbsG),
      fatG: Number(food.fatG),
    },
    servings,
  );
  return {
    foodId: food.id,
    name: food.name,
    servings,
    ...macros,
  };
}

export type PlannedItemWithFood = {
  foodId: string;
  servings: number | string;
  food: FoodSnapshotSource;
};

/** Map planned meal items → log item snapshots. */
export function snapshotsFromPlannedItems(
  items: PlannedItemWithFood[],
): MealLogItemSnapshot[] {
  return items.map((item) =>
    snapshotFromFood(item.food, Number(item.servings)),
  );
}

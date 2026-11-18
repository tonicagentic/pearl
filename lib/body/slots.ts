export const MEAL_SLOTS = ["breakfast", "lunch", "dinner", "snack"] as const;
export type MealSlot = (typeof MEAL_SLOTS)[number];

export function isMealSlot(value: unknown): value is MealSlot {
  return (
    typeof value === "string" &&
    (MEAL_SLOTS as readonly string[]).includes(value)
  );
}

export function assertMealSlot(value: unknown): MealSlot {
  if (!isMealSlot(value)) {
    throw new Error(`Invalid meal slot: ${String(value)}`);
  }
  return value;
}

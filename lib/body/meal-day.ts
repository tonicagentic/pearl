import {
  EMPTY_MACROS,
  remainingMacros,
  scaleMacros,
  sumMacros,
  type MacroTotals,
} from "@/lib/body/macros";
import { MEAL_SLOTS, type MealSlot } from "@/lib/body/slots";

export type CategorizedFood = {
  id: string;
  name: string;
  servingLabel: string;
  slot: MealSlot;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

export type SuggestedMealItem = {
  foodId: string;
  name: string;
  servings: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

export type SuggestedSlot = {
  slot: MealSlot;
  items: SuggestedMealItem[];
  totals: MacroTotals;
};

export type MealDaySuggestion = {
  slots: SuggestedSlot[];
  totals: MacroTotals;
  remainingAfter: MacroTotals;
  /** Categories that had no eligible foods when needed. */
  emptyCategories: MealSlot[];
  /** Slots skipped because they already have logged meals. */
  skippedLoggedSlots: MealSlot[];
};

const MAIN_SLOTS: MealSlot[] = ["breakfast", "lunch", "dinner"];
const MAX_SERVINGS = 3;
const SERVING_STEP = 0.5;

function foodsForSlot(
  foods: CategorizedFood[],
  slot: MealSlot,
): CategorizedFood[] {
  return foods.filter((f) => f.slot === slot);
}

/**
 * Choose servings in half-steps up to MAX_SERVINGS to close calorie gap
 * without a large overshoot. Prefer higher protein when calorie score ties.
 */
export function bestServingsForRemaining(
  food: CategorizedFood,
  remainingCalories: number,
): number {
  if (remainingCalories <= 0 || food.calories <= 0) return 0;

  let bestServings = 0;
  let bestScore = Number.POSITIVE_INFINITY;
  let bestProtein = -1;

  for (
    let servings = SERVING_STEP;
    servings <= MAX_SERVINGS + 1e-9;
    servings += SERVING_STEP
  ) {
    const rounded = Math.round(servings * 10) / 10;
    const cals = food.calories * rounded;
    const overshoot = Math.max(0, cals - remainingCalories);
    const undershoot = Math.max(0, remainingCalories - cals);
    // Penalize overshoot harder than leaving a small gap.
    const score = undershoot + overshoot * 2.5;
    const protein = food.proteinG * rounded;
    if (
      score < bestScore - 1e-6 ||
      (Math.abs(score - bestScore) < 1e-6 && protein > bestProtein)
    ) {
      bestScore = score;
      bestServings = rounded;
      bestProtein = protein;
    }
  }

  // If even 0.5 servings overshoots badly (>40% over remaining), skip.
  if (
    bestServings > 0 &&
    food.calories * bestServings > remainingCalories * 1.4 &&
    remainingCalories < food.calories * 0.5
  ) {
    return 0;
  }

  return bestServings;
}

function itemFromFood(
  food: CategorizedFood,
  servings: number,
): SuggestedMealItem {
  const macros = scaleMacros(
    {
      calories: food.calories,
      proteinG: food.proteinG,
      carbsG: food.carbsG,
      fatG: food.fatG,
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

function pickBestFood(
  candidates: CategorizedFood[],
  remaining: MacroTotals,
): { food: CategorizedFood; servings: number } | null {
  let best: { food: CategorizedFood; servings: number; score: number } | null =
    null;

  for (const food of candidates) {
    const servings = bestServingsForRemaining(food, remaining.calories);
    if (servings <= 0) continue;
    const cals = food.calories * servings;
    const protein = food.proteinG * servings;
    const overshoot = Math.max(0, cals - remaining.calories);
    const undershoot = Math.max(0, remaining.calories - cals);
    const proteinGap = Math.max(0, remaining.proteinG - protein);
    const score = undershoot + overshoot * 2.5 + proteinGap * 2;
    if (!best || score < best.score) {
      best = { food, servings, score };
    }
  }

  return best ? { food: best.food, servings: best.servings } : null;
}

/**
 * Build a one-day meal suggestion from categorized foods toward remaining macros.
 * Already-logged slots are skipped. Foods without a slot are ignored by the caller.
 */
export function suggestMealDay(input: {
  foods: CategorizedFood[];
  remaining: MacroTotals;
  loggedSlots: MealSlot[];
}): MealDaySuggestion {
  const logged = new Set(input.loggedSlots);
  const emptyCategories = new Set<MealSlot>();
  const skippedLoggedSlots = MEAL_SLOTS.filter((s) => logged.has(s));
  const slots: SuggestedSlot[] = [];
  let remaining: MacroTotals = { ...input.remaining };

  const openMainSlots = MAIN_SLOTS.filter((s) => !logged.has(s));
  let mainsLeft = openMainSlots.length;

  for (const slot of openMainSlots) {
    if (remaining.calories <= 20) break;

    const candidates = foodsForSlot(input.foods, slot);
    if (candidates.length === 0) {
      emptyCategories.add(slot);
      mainsLeft -= 1;
      continue;
    }

    // Reserve roughly equal calories for later main slots (+ a snack buffer).
    const snackReserve = logged.has("snack") ? 0 : Math.min(250, remaining.calories * 0.15);
    const budgetForSlot = Math.max(
      80,
      (remaining.calories - snackReserve) / Math.max(1, mainsLeft),
    );
    const slotRemaining: MacroTotals = {
      ...remaining,
      calories: Math.min(remaining.calories, budgetForSlot * 1.15),
      proteinG: remaining.proteinG / Math.max(1, mainsLeft),
    };

    const pick = pickBestFood(candidates, slotRemaining);
    if (!pick) {
      emptyCategories.add(slot);
      mainsLeft -= 1;
      continue;
    }

    const item = itemFromFood(pick.food, pick.servings);
    slots.push({
      slot,
      items: [item],
      totals: {
        calories: item.calories,
        proteinG: item.proteinG,
        carbsG: item.carbsG,
        fatG: item.fatG,
      },
    });
    remaining = remainingMacros(remaining, {
      calories: item.calories,
      proteinG: item.proteinG,
      carbsG: item.carbsG,
      fatG: item.fatG,
    });
    mainsLeft -= 1;
  }

  // Snacks: fill remaining calories with one or more snack foods.
  if (!logged.has("snack") && remaining.calories > 40) {
    const snackFoods = foodsForSlot(input.foods, "snack");
    if (snackFoods.length === 0) {
      emptyCategories.add("snack");
    } else {
      const snackItems: SuggestedMealItem[] = [];
      const used = new Set<string>();
      let guard = 0;
      while (remaining.calories > 40 && guard < 6) {
        guard += 1;
        const available = snackFoods.filter((f) => !used.has(f.id));
        if (available.length === 0) break;
        const pick = pickBestFood(available, remaining);
        if (!pick) break;
        used.add(pick.food.id);
        const item = itemFromFood(pick.food, pick.servings);
        snackItems.push(item);
        remaining = remainingMacros(remaining, {
          calories: item.calories,
          proteinG: item.proteinG,
          carbsG: item.carbsG,
          fatG: item.fatG,
        });
      }
      if (snackItems.length > 0) {
        slots.push({
          slot: "snack",
          items: snackItems,
          totals: sumMacros(snackItems),
        });
      } else if (snackFoods.length > 0 && remaining.calories > 40) {
        // Had snacks but none fit remaining budget — not an empty category.
      }
    }
  }

  const totals =
    slots.length === 0
      ? { ...EMPTY_MACROS }
      : sumMacros(slots.map((s) => s.totals));

  return {
    slots,
    totals,
    remainingAfter: remaining,
    emptyCategories: [...emptyCategories],
    skippedLoggedSlots,
  };
}

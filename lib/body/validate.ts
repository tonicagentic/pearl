/**
 * Pure parsers for Pearl Body payloads. They throw Error on invalid input
 * and return the shape stored by lib/db/body.ts.
 */

export const BODY_GOALS = ["build", "lose", "recomp", "maintain"] as const;
export type BodyGoal = (typeof BODY_GOALS)[number];

export const BODY_DIET_STYLES = [
  "balanced",
  "high-protein",
  "vegetarian",
] as const;
export type BodyDietStyle = (typeof BODY_DIET_STYLES)[number];

export const BODY_SPLITS = [
  "push-pull-legs",
  "upper-lower",
  "full-body",
] as const;
export type BodySplit = (typeof BODY_SPLITS)[number];

export const BODY_MUSCLE_GROUPS = [
  "chest",
  "back",
  "shoulders",
  "biceps",
  "triceps",
  "quads",
  "hamstrings",
  "glutes",
  "calves",
  "core",
] as const;
export type BodyMuscleGroup = (typeof BODY_MUSCLE_GROUPS)[number];

export const BODY_MEAL_SLOTS = [
  "breakfast",
  "lunch",
  "dinner",
  "snack",
] as const;
export type BodyMealSlot = (typeof BODY_MEAL_SLOTS)[number];

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export type BodySettings = {
  goal: BodyGoal;
  dietStyle: BodyDietStyle;
  trainingDays: number[];
  split: BodySplit;
  calorieTarget: number;
  proteinTarget: number;
  targetWeight: string | null;
};

export type BodyExercise = {
  name: string;
  muscleGroup: BodyMuscleGroup;
  sets: number;
  reps: number;
  weight: number;
};

export type BodySessionInput = {
  date: string;
  splitDayId: string;
  splitDayLabel: string;
  muscleGroups: BodyMuscleGroup[];
  exercises: BodyExercise[];
  notes: string | null;
};

export type BodyMeal = {
  slot: BodyMealSlot;
  recipeId: string;
  name: string;
  calories: number;
  protein: number;
  scale: number;
};

export type BodyMealDay = {
  date: string;
  meals: BodyMeal[];
};

export type BodyMealPlanInput = {
  weekStart: string;
  days: BodyMealDay[];
};

export type BodyGroceryItem = {
  id: string;
  name: string;
  amount: string;
  aisle: string;
  checked: boolean;
};

export type BodyGroceryInput = {
  weekStart: string;
  items: BodyGroceryItem[];
};

function asObject(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function oneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
  label: string,
): T {
  if (
    typeof value === "string" &&
    (allowed as readonly string[]).includes(value)
  ) {
    return value as T;
  }
  throw new Error(`${label} must be one of ${allowed.join(", ")}.`);
}

function integerInRange(
  value: unknown,
  min: number,
  max: number,
  label: string,
): number {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < min ||
    value > max
  ) {
    throw new Error(`${label} must be an integer from ${min} to ${max}.`);
  }
  return value;
}

function numberInRange(
  value: unknown,
  min: number,
  max: number,
  label: string,
): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < min ||
    value > max
  ) {
    throw new Error(`${label} must be a number from ${min} to ${max}.`);
  }
  return value;
}

function text(value: unknown, max: number, label: string): string {
  if (typeof value !== "string") {
    throw new Error(`${label} must be text.`);
  }
  const trimmed = value.trim();
  if (trimmed.length > max) {
    throw new Error(`${label} must be at most ${max} characters.`);
  }
  return trimmed;
}

function requiredText(value: unknown, max: number, label: string): string {
  const trimmed = text(value, max, label);
  if (trimmed.length === 0) {
    throw new Error(`${label} is required.`);
  }
  return trimmed;
}

function optionalText(
  value: unknown,
  max: number,
  label: string,
): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = text(value, max, label);
  return trimmed.length > 0 ? trimmed : null;
}

function calendarDate(value: unknown, label: string): string {
  if (typeof value !== "string") {
    throw new Error(`${label} must be YYYY-MM-DD.`);
  }
  const match = ISO_DATE.exec(value);
  if (!match) {
    throw new Error(`${label} must be YYYY-MM-DD.`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error(`${label} must be YYYY-MM-DD.`);
  }
  return value;
}

function trainingDays(value: unknown): number[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("trainingDays needs at least one day.");
  }
  const seen = new Set<number>();
  const days: number[] = [];
  for (const day of value) {
    if (
      typeof day !== "number" ||
      !Number.isInteger(day) ||
      day < 0 ||
      day > 6 ||
      seen.has(day)
    ) {
      throw new Error("trainingDays must be unique integers from 0 to 6.");
    }
    seen.add(day);
    days.push(day);
  }
  return days;
}

function muscleGroupList(value: unknown): BodyMuscleGroup[] {
  if (!Array.isArray(value)) {
    throw new Error("muscleGroups must be a list.");
  }
  return value.map((item) => oneOf(item, BODY_MUSCLE_GROUPS, "muscleGroup"));
}

function exercise(value: unknown): BodyExercise {
  const body = asObject(value, "exercise");
  return {
    name: requiredText(body.name, 120, "exercise name"),
    muscleGroup: oneOf(body.muscleGroup, BODY_MUSCLE_GROUPS, "muscleGroup"),
    sets: integerInRange(body.sets, 1, 20, "sets"),
    reps: integerInRange(body.reps, 1, 100, "reps"),
    weight: numberInRange(body.weight, 0, 2000, "weight"),
  };
}

function exercises(value: unknown): BodyExercise[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 40) {
    throw new Error("A session needs 1 to 40 exercises.");
  }
  return value.map((item) => exercise(item));
}

function meal(value: unknown): BodyMeal {
  const body = asObject(value, "meal");
  return {
    slot: oneOf(body.slot, BODY_MEAL_SLOTS, "slot"),
    recipeId: text(body.recipeId, 80, "recipeId"),
    name: requiredText(body.name, 120, "meal name"),
    calories: integerInRange(body.calories, 0, 5000, "calories"),
    protein: integerInRange(body.protein, 0, 500, "protein"),
    scale: numberInRange(body.scale, 0.5, 2, "scale"),
  };
}

function meals(value: unknown): BodyMeal[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 6) {
    throw new Error("A day needs 1 to 6 meals.");
  }
  return value.map((item) => meal(item));
}

function mealDay(value: unknown): BodyMealDay {
  const body = asObject(value, "day");
  return {
    date: calendarDate(body.date, "date"),
    meals: meals(body.meals),
  };
}

function groceryItem(value: unknown): BodyGroceryItem {
  const body = asObject(value, "item");
  if (typeof body.checked !== "boolean") {
    throw new Error("checked must be a boolean.");
  }
  return {
    id: requiredText(body.id, 120, "id"),
    name: requiredText(body.name, 80, "name"),
    amount: text(body.amount, 80, "amount"),
    aisle: text(body.aisle, 40, "aisle"),
    checked: body.checked,
  };
}

export function parseBodySettings(value: unknown): BodySettings {
  const body = asObject(value, "settings");
  return {
    goal: oneOf(body.goal, BODY_GOALS, "goal"),
    dietStyle: oneOf(body.dietStyle, BODY_DIET_STYLES, "dietStyle"),
    trainingDays: trainingDays(body.trainingDays),
    split: oneOf(body.split, BODY_SPLITS, "split"),
    calorieTarget: integerInRange(body.calorieTarget, 800, 6000, "calorieTarget"),
    proteinTarget: integerInRange(body.proteinTarget, 40, 400, "proteinTarget"),
    targetWeight: optionalText(body.targetWeight, 40, "targetWeight"),
  };
}

export function parseBodySession(value: unknown): BodySessionInput {
  const body = asObject(value, "session");
  return {
    date: calendarDate(body.date, "date"),
    splitDayId: requiredText(body.splitDayId, 40, "splitDayId"),
    splitDayLabel: requiredText(body.splitDayLabel, 40, "splitDayLabel"),
    muscleGroups: muscleGroupList(body.muscleGroups),
    exercises: exercises(body.exercises),
    notes: optionalText(body.notes, 500, "notes"),
  };
}

export function parseBodyMealPlan(value: unknown): BodyMealPlanInput {
  const body = asObject(value, "mealPlan");
  if (!Array.isArray(body.days) || body.days.length < 1 || body.days.length > 14) {
    throw new Error("A meal plan needs 1 to 14 days.");
  }
  return {
    weekStart: calendarDate(body.weekStart, "weekStart"),
    days: body.days.map((day) => mealDay(day)),
  };
}

export function parseBodyGrocery(value: unknown): BodyGroceryInput {
  const body = asObject(value, "grocery");
  if (!Array.isArray(body.items) || body.items.length > 400) {
    throw new Error("A grocery list can hold at most 400 items.");
  }
  return {
    weekStart: calendarDate(body.weekStart, "weekStart"),
    items: body.items.map((item) => groceryItem(item)),
  };
}

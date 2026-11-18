import { and, asc, desc, eq, gte, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  bodyExercises,
  bodyFoods,
  bodyMealLogItems,
  bodyMealLogs,
  bodyMealPlans,
  bodyPlannedMealItems,
  bodyPlannedMeals,
  bodyProgramDays,
  bodyProgramExercises,
  bodyPrograms,
  bodyRotationState,
  bodyRotationSteps,
  bodySessionSets,
  bodySessions,
  bodyTargets,
  bodyWeighIns,
} from "@/lib/db/body-schema";
import { getUserId } from "./context";
import {
  EMPTY_MACROS,
  macrosFromNumeric,
  remainingMacros,
  sumMacros,
  type MacroTotals,
} from "./macros";
import { lookupOpenFoodFacts } from "./barcode-lookup";
import {
  suggestMealDay,
  type CategorizedFood,
  type MealDaySuggestion,
} from "./meal-day";
import { estimateNutrition } from "./nutrition-estimate";
import {
  advanceRotation,
  DEFAULT_ROTATION_STEPS,
  isMuscle,
  missingMusclesFromSteps,
  parseMuscles,
  resolveRotationAssignment,
  serializeMuscles,
  undoRotationCompletion,
  type Muscle,
  type RotationAssignment,
} from "./rotation";
import { assertMealSlot, isMealSlot, type MealSlot } from "./slots";
import { snapshotFromFood, snapshotsFromPlannedItems } from "./snapshots";
import {
  isTrainingDay,
  parseTrainingDays,
  serializeTrainingDays,
  weekdayFromDate,
} from "./training";

function tx() {
  return db;
}

function uid(): string {
  return getUserId();
}

function macroStrings(m: MacroTotals) {
  return {
    calories: String(m.calories),
    proteinG: String(m.proteinG),
    carbsG: String(m.carbsG),
    fatG: String(m.fatG),
  };
}

function mapFood(row: typeof bodyFoods.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    servingLabel: row.servingLabel,
    slot: isMealSlot(row.slot) ? row.slot : null,
    barcode: row.barcode ?? null,
    ...macrosFromNumeric(row),
  };
}

function cleanBarcode(raw: string): string {
  return raw.replace(/\D/g, "");
}

function optionalSlot(value: unknown): MealSlot | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  return assertMealSlot(value);
}

function mapExercise(row: typeof bodyExercises.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    muscleGroup: row.muscleGroup,
  };
}

// --- Targets ---

export async function getTargets() {
  const rows = await tx()
    .select()
    .from(bodyTargets)
    .where(eq(bodyTargets.userId, uid()))
    .limit(1);
  const row = rows[0];
  if (!row) {
    return {
      calories: 2000,
      proteinG: 150,
      carbsG: 200,
      fatG: 65,
      trainingDays: [] as number[],
    };
  }
  return {
    ...macrosFromNumeric(row),
    trainingDays: parseTrainingDays(row.trainingDays),
  };
}

export async function putTargets(input: {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  trainingDays: number[];
}) {
  const existing = await tx()
    .select()
    .from(bodyTargets)
    .where(eq(bodyTargets.userId, uid()))
    .limit(1);

  const values = {
    userId: uid(),
    ...macroStrings(input),
    trainingDays: serializeTrainingDays(input.trainingDays),
    updatedAt: new Date(),
  };

  if (existing[0]) {
    await tx()
      .update(bodyTargets)
      .set(values)
      .where(eq(bodyTargets.id, existing[0].id));
  } else {
    await tx().insert(bodyTargets).values(values);
  }
  return getTargets();
}

// --- Foods ---

export async function listFoods() {
  const rows = await tx()
    .select()
    .from(bodyFoods)
    .where(eq(bodyFoods.userId, uid()))
    .orderBy(asc(bodyFoods.name));
  return { foods: rows.map(mapFood) };
}

export async function createFood(input: {
  name: string;
  servingLabel?: string;
  slot?: MealSlot | null;
  barcode?: string | null;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}) {
  const slot =
    input.slot === undefined || input.slot === null
      ? null
      : assertMealSlot(input.slot);
  const barcode =
    input.barcode === undefined || input.barcode === null || input.barcode === ""
      ? null
      : cleanBarcode(input.barcode);
  if (barcode && (barcode.length < 8 || barcode.length > 14)) {
    throw new Error("Invalid barcode");
  }
  const [row] = await tx()
    .insert(bodyFoods)
    .values({
      userId: uid(),
      name: input.name.trim(),
      servingLabel: input.servingLabel?.trim() || "1 serving",
      slot,
      barcode,
      ...macroStrings(input),
    })
    .returning();
  return { food: mapFood(row) };
}

export async function updateFood(
  id: string,
  input: Partial<{
    name: string;
    servingLabel: string;
    slot: MealSlot | null;
    barcode: string | null;
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
  }>,
) {
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (input.name != null) patch.name = input.name.trim();
  if (input.servingLabel != null) patch.servingLabel = input.servingLabel.trim();
  if (input.slot !== undefined) {
    patch.slot =
      input.slot === null ? null : assertMealSlot(input.slot);
  }
  if (input.barcode !== undefined) {
    if (input.barcode === null || input.barcode === "") {
      patch.barcode = null;
    } else {
      const barcode = cleanBarcode(input.barcode);
      if (barcode.length < 8 || barcode.length > 14) {
        throw new Error("Invalid barcode");
      }
      patch.barcode = barcode;
    }
  }
  if (input.calories != null) patch.calories = String(input.calories);
  if (input.proteinG != null) patch.proteinG = String(input.proteinG);
  if (input.carbsG != null) patch.carbsG = String(input.carbsG);
  if (input.fatG != null) patch.fatG = String(input.fatG);

  const [row] = await tx()
    .update(bodyFoods)
    .set(patch)
    .where(and(eq(bodyFoods.id, id), eq(bodyFoods.userId, uid())))
    .returning();
  if (!row) throw new Error("Not found");
  return { food: mapFood(row) };
}

export async function getFoodByBarcode(code: string) {
  const barcode = cleanBarcode(code);
  if (!barcode) throw new Error("barcode is required");
  const rows = await tx()
    .select()
    .from(bodyFoods)
    .where(and(eq(bodyFoods.userId, uid()), eq(bodyFoods.barcode, barcode)))
    .limit(1);
  return { food: rows[0] ? mapFood(rows[0]) : null };
}

export async function lookupBarcodeFood(code: string) {
  const existing = await getFoodByBarcode(code);
  if (existing.food) {
    return {
      food: existing.food,
      lookup: null as null,
      existing: true,
    };
  }
  const lookup = await lookupOpenFoodFacts(code);
  return { food: null, lookup, existing: false };
}

export async function listRecentFoods(limit = 12) {
  const capped = Math.min(Math.max(1, Math.floor(limit) || 12), 40);
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 14);
  const sinceIso = since.toISOString().slice(0, 10);

  const rows = await tx()
    .select({
      foodId: bodyMealLogItems.foodId,
      loggedAt: bodyMealLogItems.createdAt,
    })
    .from(bodyMealLogItems)
    .innerJoin(bodyMealLogs, eq(bodyMealLogItems.mealLogId, bodyMealLogs.id))
    .where(
      and(eq(bodyMealLogItems.userId, uid()), gte(bodyMealLogs.date, sinceIso)),
    )
    .orderBy(desc(bodyMealLogItems.createdAt))
    .limit(200);

  const orderedIds: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (!row.foodId || seen.has(row.foodId)) continue;
    seen.add(row.foodId);
    orderedIds.push(row.foodId);
    if (orderedIds.length >= capped) break;
  }

  if (orderedIds.length === 0) {
    return { foods: [] as ReturnType<typeof mapFood>[] };
  }

  const foods = await tx()
    .select()
    .from(bodyFoods)
    .where(and(eq(bodyFoods.userId, uid()), inArray(bodyFoods.id, orderedIds)));

  // Preserve recency order from orderedIds
  const byId = new Map(foods.map((f) => [f.id, f]));
  return {
    foods: orderedIds
      .map((id) => byId.get(id))
      .filter((f): f is NonNullable<typeof f> => Boolean(f))
      .map(mapFood),
  };
}

export async function estimateFoodNutrition(input: {
  name: string;
  slot?: MealSlot | null;
}) {
  const slot = optionalSlot(input.slot);
  const estimate = await estimateNutrition({
    name: input.name,
    slot: slot === undefined ? null : slot,
  });
  return { estimate };
}

export async function deleteFood(id: string) {
  const [row] = await tx()
    .delete(bodyFoods)
    .where(and(eq(bodyFoods.id, id), eq(bodyFoods.userId, uid())))
    .returning();
  if (!row) throw new Error("Not found");
  return { ok: true };
}

// --- Day summary ---

async function mealLogsForDate(date: string) {
  const logs = await tx()
    .select()
    .from(bodyMealLogs)
    .where(and(eq(bodyMealLogs.userId, uid()), eq(bodyMealLogs.date, date)))
    .orderBy(asc(bodyMealLogs.slot));

  const items =
    logs.length === 0
      ? []
      : await tx()
          .select()
          .from(bodyMealLogItems)
          .where(eq(bodyMealLogItems.userId, uid()));

  return logs.map((log) => {
    const logItems = items
      .filter((i) => i.mealLogId === log.id)
      .map((i) => ({
        id: i.id,
        foodId: i.foodId,
        name: i.name,
        servings: Number(i.servings),
        ...macrosFromNumeric(i),
      }));
    return {
      id: log.id,
      date: log.date,
      slot: log.slot as MealSlot,
      notes: log.notes,
      items: logItems,
      totals: sumMacros(logItems),
    };
  });
}

async function programDayForWeekday(weekday: number) {
  const programs = await tx()
    .select()
    .from(bodyPrograms)
    .where(
      and(eq(bodyPrograms.userId, uid()), eq(bodyPrograms.isActive, true)),
    )
    .limit(1);
  const program = programs[0];
  if (!program) return null;

  const days = await tx()
    .select()
    .from(bodyProgramDays)
    .where(
      and(
        eq(bodyProgramDays.programId, program.id),
        eq(bodyProgramDays.weekday, weekday),
      ),
    )
    .limit(1);
  const day = days[0];
  if (!day) return null;

  const exercises = await tx()
    .select({
      pe: bodyProgramExercises,
      exercise: bodyExercises,
    })
    .from(bodyProgramExercises)
    .innerJoin(
      bodyExercises,
      eq(bodyProgramExercises.exerciseId, bodyExercises.id),
    )
    .where(eq(bodyProgramExercises.programDayId, day.id))
    .orderBy(asc(bodyProgramExercises.sortOrder));

  return {
    id: day.id,
    programId: program.id,
    programName: program.name,
    weekday: day.weekday,
    name: day.name,
    exercises: exercises.map(({ pe, exercise }) => ({
      id: pe.id,
      exerciseId: exercise.id,
      name: exercise.name,
      muscleGroup: exercise.muscleGroup,
      sortOrder: pe.sortOrder,
      plannedSets: pe.plannedSets,
      plannedReps: pe.plannedReps,
      targetWeight: pe.targetWeight != null ? Number(pe.targetWeight) : null,
    })),
  };
}

async function sessionForDate(date: string) {
  const sessions = await tx()
    .select()
    .from(bodySessions)
    .where(and(eq(bodySessions.userId, uid()), eq(bodySessions.date, date)))
    .limit(1);
  const session = sessions[0];
  if (!session) return null;

  const sets = await tx()
    .select({
      set: bodySessionSets,
      exercise: bodyExercises,
    })
    .from(bodySessionSets)
    .innerJoin(bodyExercises, eq(bodySessionSets.exerciseId, bodyExercises.id))
    .where(eq(bodySessionSets.sessionId, session.id))
    .orderBy(asc(bodySessionSets.setNumber));

  return {
    id: session.id,
    date: session.date,
    programDayId: session.programDayId,
    notes: session.notes,
    sets: sets.map(({ set, exercise }) => ({
      id: set.id,
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      setNumber: set.setNumber,
      weight: set.weight != null ? Number(set.weight) : null,
      reps: set.reps,
      completed: set.completed,
    })),
  };
}

async function latestWeighIn() {
  const rows = await tx()
    .select()
    .from(bodyWeighIns)
    .where(eq(bodyWeighIns.userId, uid()))
    .orderBy(desc(bodyWeighIns.date))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    date: row.date,
    weightLbs: Number(row.weightLbs),
    notes: row.notes,
  };
}

export async function getDay(date: string) {
  const targets = await getTargets();
  const meals = await mealLogsForDate(date);
  const logged = sumMacros(meals.map((m) => m.totals));
  const weekday = weekdayFromDate(date);
  const training = isTrainingDay(targets.trainingDays, weekday);
  const programDay = training ? await programDayForWeekday(weekday) : null;
  const session = await sessionForDate(date);
  const weighIn = await latestWeighIn();
  const rotation = await getRotationAssignment(date, training);

  return {
    date,
    weekday,
    targets,
    meals,
    totals: logged,
    remaining: remainingMacros(targets, logged),
    isTrainingDay: training,
    programDay,
    session,
    latestWeighIn: weighIn,
    rotation,
  };
}

export async function suggestMealsForDate(
  date: string,
): Promise<{ suggestion: MealDaySuggestion }> {
  const day = await getDay(date);
  const { foods } = await listFoods();
  const categorized: CategorizedFood[] = foods
    .filter((f): f is typeof f & { slot: MealSlot } => f.slot != null)
    .map((f) => ({
      id: f.id,
      name: f.name,
      servingLabel: f.servingLabel,
      slot: f.slot,
      calories: f.calories,
      proteinG: f.proteinG,
      carbsG: f.carbsG,
      fatG: f.fatG,
    }));
  const loggedSlots = [
    ...new Set(day.meals.map((m) => m.slot as MealSlot)),
  ];
  const suggestion = suggestMealDay({
    foods: categorized,
    remaining: {
      calories: Math.max(0, day.remaining.calories),
      proteinG: Math.max(0, day.remaining.proteinG),
      carbsG: Math.max(0, day.remaining.carbsG),
      fatG: Math.max(0, day.remaining.fatG),
    },
    loggedSlots,
  });
  return { suggestion };
}

// --- Meal logs ---

export async function createMealLog(input: {
  date: string;
  slot: string;
  notes?: string;
  items?: Array<{ foodId: string; servings: number }>;
}) {
  const slot = assertMealSlot(input.slot);
  const [log] = await tx()
    .insert(bodyMealLogs)
    .values({
      userId: uid(),
      date: input.date,
      slot,
      notes: input.notes ?? null,
    })
    .returning();

  const createdItems = [];
  for (const item of input.items ?? []) {
    const foods = await tx()
      .select()
      .from(bodyFoods)
      .where(and(eq(bodyFoods.id, item.foodId), eq(bodyFoods.userId, uid())))
      .limit(1);
    const food = foods[0];
    if (!food) throw new Error(`Invalid food: ${item.foodId}`);
    const snap = snapshotFromFood(food, item.servings);
    const [row] = await tx()
      .insert(bodyMealLogItems)
      .values({
        userId: uid(),
        mealLogId: log.id,
        foodId: snap.foodId,
        name: snap.name,
        servings: String(snap.servings),
        ...macroStrings(snap),
      })
      .returning();
    createdItems.push({
      id: row.id,
      foodId: row.foodId,
      name: row.name,
      servings: Number(row.servings),
      ...macrosFromNumeric(row),
    });
  }

  return {
    mealLog: {
      id: log.id,
      date: log.date,
      slot: log.slot,
      notes: log.notes,
      items: createdItems,
      totals: sumMacros(createdItems),
    },
  };
}

export async function addMealLogItem(
  mealLogId: string,
  input: { foodId: string; servings: number },
) {
  const logs = await tx()
    .select()
    .from(bodyMealLogs)
    .where(and(eq(bodyMealLogs.id, mealLogId), eq(bodyMealLogs.userId, uid())))
    .limit(1);
  if (!logs[0]) throw new Error("Not found");

  const foods = await tx()
    .select()
    .from(bodyFoods)
    .where(and(eq(bodyFoods.id, input.foodId), eq(bodyFoods.userId, uid())))
    .limit(1);
  const food = foods[0];
  if (!food) throw new Error("Invalid food");

  const snap = snapshotFromFood(food, input.servings);
  const [row] = await tx()
    .insert(bodyMealLogItems)
    .values({
      userId: uid(),
      mealLogId,
      foodId: snap.foodId,
      name: snap.name,
      servings: String(snap.servings),
      ...macroStrings(snap),
    })
    .returning();

  return {
    item: {
      id: row.id,
      foodId: row.foodId,
      name: row.name,
      servings: Number(row.servings),
      ...macrosFromNumeric(row),
    },
  };
}

export async function deleteMealLogItem(itemId: string) {
  const [row] = await tx()
    .delete(bodyMealLogItems)
    .where(
      and(eq(bodyMealLogItems.id, itemId), eq(bodyMealLogItems.userId, uid())),
    )
    .returning();
  if (!row) throw new Error("Not found");
  return { ok: true };
}

export async function deleteMealLog(mealLogId: string) {
  const [row] = await tx()
    .delete(bodyMealLogs)
    .where(
      and(eq(bodyMealLogs.id, mealLogId), eq(bodyMealLogs.userId, uid())),
    )
    .returning();
  if (!row) throw new Error("Not found");
  return { ok: true };
}

export async function mealLogFromPlan(input: {
  date: string;
  slot: string;
}) {
  const slot = assertMealSlot(input.slot);
  const weekday = weekdayFromDate(input.date);

  const plans = await tx()
    .select()
    .from(bodyMealPlans)
    .where(
      and(eq(bodyMealPlans.userId, uid()), eq(bodyMealPlans.isActive, true)),
    )
    .limit(1);
  const plan = plans[0];
  if (!plan) throw new Error("No active meal plan");

  const planned = await tx()
    .select()
    .from(bodyPlannedMeals)
    .where(
      and(
        eq(bodyPlannedMeals.mealPlanId, plan.id),
        eq(bodyPlannedMeals.weekday, weekday),
        eq(bodyPlannedMeals.slot, slot),
      ),
    )
    .limit(1);
  const meal = planned[0];
  if (!meal) throw new Error("No planned meal for that slot");

  const items = await tx()
    .select({
      item: bodyPlannedMealItems,
      food: bodyFoods,
    })
    .from(bodyPlannedMealItems)
    .innerJoin(bodyFoods, eq(bodyPlannedMealItems.foodId, bodyFoods.id))
    .where(eq(bodyPlannedMealItems.plannedMealId, meal.id));

  const snapshots = snapshotsFromPlannedItems(
    items.map(({ item, food }) => ({
      foodId: item.foodId,
      servings: item.servings,
      food,
    })),
  );

  return createMealLog({
    date: input.date,
    slot,
    items: snapshots.map((s) => ({ foodId: s.foodId, servings: s.servings })),
  });
}

// --- Meal plan ---

export async function getMealPlan() {
  const plans = await tx()
    .select()
    .from(bodyMealPlans)
    .where(
      and(eq(bodyMealPlans.userId, uid()), eq(bodyMealPlans.isActive, true)),
    )
    .limit(1);
  const plan = plans[0];
  if (!plan) {
    return { plan: null as null };
  }

  const meals = await tx()
    .select()
    .from(bodyPlannedMeals)
    .where(eq(bodyPlannedMeals.mealPlanId, plan.id))
    .orderBy(asc(bodyPlannedMeals.weekday), asc(bodyPlannedMeals.slot));

  const allItems =
    meals.length === 0
      ? []
      : await tx()
          .select({
            item: bodyPlannedMealItems,
            food: bodyFoods,
          })
          .from(bodyPlannedMealItems)
          .innerJoin(bodyFoods, eq(bodyPlannedMealItems.foodId, bodyFoods.id))
          .where(eq(bodyPlannedMealItems.userId, uid()));

  return {
    plan: {
      id: plan.id,
      name: plan.name,
      meals: meals.map((m) => ({
        id: m.id,
        weekday: m.weekday,
        slot: m.slot as MealSlot,
        items: allItems
          .filter(({ item }) => item.plannedMealId === m.id)
          .map(({ item, food }) => ({
            id: item.id,
            foodId: food.id,
            name: food.name,
            servings: Number(item.servings),
            ...macrosFromNumeric(
              snapshotFromFood(food, Number(item.servings)),
            ),
          })),
      })),
    },
  };
}

export async function putMealPlan(input: {
  name?: string;
  meals: Array<{
    weekday: number;
    slot: string;
    items: Array<{ foodId: string; servings: number }>;
  }>;
}) {
  // Deactivate existing active plans
  await tx()
    .update(bodyMealPlans)
    .set({ isActive: false, updatedAt: new Date() })
    .where(
      and(eq(bodyMealPlans.userId, uid()), eq(bodyMealPlans.isActive, true)),
    );

  const [plan] = await tx()
    .insert(bodyMealPlans)
    .values({
      userId: uid(),
      name: input.name?.trim() || "Weekly plan",
      isActive: true,
    })
    .returning();

  for (const meal of input.meals) {
    const slot = assertMealSlot(meal.slot);
    if (!Number.isInteger(meal.weekday) || meal.weekday < 0 || meal.weekday > 6) {
      throw new Error(`Invalid weekday: ${meal.weekday}`);
    }
    const [planned] = await tx()
      .insert(bodyPlannedMeals)
      .values({
        userId: uid(),
        mealPlanId: plan.id,
        weekday: meal.weekday,
        slot,
      })
      .returning();

    for (const item of meal.items) {
      await tx().insert(bodyPlannedMealItems).values({
        userId: uid(),
        plannedMealId: planned.id,
        foodId: item.foodId,
        servings: String(item.servings),
      });
    }
  }

  return getMealPlan();
}

// --- Exercises ---

export async function listExercises() {
  const rows = await tx()
    .select()
    .from(bodyExercises)
    .where(eq(bodyExercises.userId, uid()))
    .orderBy(asc(bodyExercises.name));
  return { exercises: rows.map(mapExercise) };
}

export async function createExercise(input: {
  name: string;
  muscleGroup?: string | null;
}) {
  const [row] = await tx()
    .insert(bodyExercises)
    .values({
      userId: uid(),
      name: input.name.trim(),
      muscleGroup: input.muscleGroup?.trim() || null,
    })
    .returning();
  return { exercise: mapExercise(row) };
}

// --- Program ---

export async function getProgram() {
  const programs = await tx()
    .select()
    .from(bodyPrograms)
    .where(
      and(eq(bodyPrograms.userId, uid()), eq(bodyPrograms.isActive, true)),
    )
    .limit(1);
  const program = programs[0];
  if (!program) return { program: null as null };

  const days = await tx()
    .select()
    .from(bodyProgramDays)
    .where(eq(bodyProgramDays.programId, program.id))
    .orderBy(asc(bodyProgramDays.weekday));

  const exercises =
    days.length === 0
      ? []
      : await tx()
          .select({
            pe: bodyProgramExercises,
            exercise: bodyExercises,
          })
          .from(bodyProgramExercises)
          .innerJoin(
            bodyExercises,
            eq(bodyProgramExercises.exerciseId, bodyExercises.id),
          )
          .where(eq(bodyProgramExercises.userId, uid()))
          .orderBy(asc(bodyProgramExercises.sortOrder));

  return {
    program: {
      id: program.id,
      name: program.name,
      days: days.map((day) => ({
        id: day.id,
        weekday: day.weekday,
        name: day.name,
        exercises: exercises
          .filter(({ pe }) => pe.programDayId === day.id)
          .map(({ pe, exercise }) => ({
            id: pe.id,
            exerciseId: exercise.id,
            name: exercise.name,
            muscleGroup: exercise.muscleGroup,
            sortOrder: pe.sortOrder,
            plannedSets: pe.plannedSets,
            plannedReps: pe.plannedReps,
            targetWeight:
              pe.targetWeight != null ? Number(pe.targetWeight) : null,
          })),
      })),
    },
  };
}

export async function putProgram(input: {
  name?: string;
  days: Array<{
    weekday: number;
    name?: string | null;
    exercises: Array<{
      exerciseId: string;
      sortOrder?: number;
      plannedSets: number;
      plannedReps: number;
      targetWeight?: number | null;
    }>;
  }>;
}) {
  await tx()
    .update(bodyPrograms)
    .set({ isActive: false, updatedAt: new Date() })
    .where(
      and(eq(bodyPrograms.userId, uid()), eq(bodyPrograms.isActive, true)),
    );

  const [program] = await tx()
    .insert(bodyPrograms)
    .values({
      userId: uid(),
      name: input.name?.trim() || "Training program",
      isActive: true,
    })
    .returning();

  for (const day of input.days) {
    if (!Number.isInteger(day.weekday) || day.weekday < 0 || day.weekday > 6) {
      throw new Error(`Invalid weekday: ${day.weekday}`);
    }
    const [programDay] = await tx()
      .insert(bodyProgramDays)
      .values({
        userId: uid(),
        programId: program.id,
        weekday: day.weekday,
        name: day.name ?? null,
      })
      .returning();

    for (const [idx, ex] of day.exercises.entries()) {
      await tx().insert(bodyProgramExercises).values({
        userId: uid(),
        programDayId: programDay.id,
        exerciseId: ex.exerciseId,
        sortOrder: ex.sortOrder ?? idx,
        plannedSets: ex.plannedSets,
        plannedReps: ex.plannedReps,
        targetWeight:
          ex.targetWeight != null ? String(ex.targetWeight) : null,
      });
    }
  }

  return getProgram();
}

// --- Sessions ---

export async function createSession(input: {
  date: string;
  fromProgram?: boolean;
  notes?: string;
}) {
  const weekday = weekdayFromDate(input.date);
  let programDayId: string | null = null;
  let seedExercises: Array<{
    exerciseId: string;
    plannedSets: number;
    plannedReps: number;
    targetWeight: number | null;
  }> = [];

  if (input.fromProgram !== false) {
    const day = await programDayForWeekday(weekday);
    if (day) {
      programDayId = day.id;
      seedExercises = day.exercises.map((e) => ({
        exerciseId: e.exerciseId,
        plannedSets: e.plannedSets,
        plannedReps: e.plannedReps,
        targetWeight: e.targetWeight,
      }));
    }
  }

  const [session] = await tx()
    .insert(bodySessions)
    .values({
      userId: uid(),
      date: input.date,
      programDayId,
      notes: input.notes ?? null,
    })
    .returning();

  const createdSets = [];
  for (const ex of seedExercises) {
    for (let setNumber = 1; setNumber <= ex.plannedSets; setNumber++) {
      const [set] = await tx()
        .insert(bodySessionSets)
        .values({
          userId: uid(),
          sessionId: session.id,
          exerciseId: ex.exerciseId,
          setNumber,
          weight: ex.targetWeight != null ? String(ex.targetWeight) : null,
          reps: ex.plannedReps,
          completed: false,
        })
        .returning();
      createdSets.push(set);
    }
  }

  return sessionForDate(input.date);
}

export async function upsertSessionSet(
  sessionId: string,
  input: {
    id?: string;
    exerciseId: string;
    setNumber: number;
    weight?: number | null;
    reps?: number | null;
    completed?: boolean;
  },
) {
  const sessions = await tx()
    .select()
    .from(bodySessions)
    .where(
      and(eq(bodySessions.id, sessionId), eq(bodySessions.userId, uid())),
    )
    .limit(1);
  if (!sessions[0]) throw new Error("Not found");

  if (input.id) {
    const [row] = await tx()
      .update(bodySessionSets)
      .set({
        exerciseId: input.exerciseId,
        setNumber: input.setNumber,
        weight: input.weight != null ? String(input.weight) : null,
        reps: input.reps ?? null,
        completed: input.completed ?? false,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(bodySessionSets.id, input.id),
          eq(bodySessionSets.userId, uid()),
        ),
      )
      .returning();
    if (!row) throw new Error("Not found");
  } else {
    await tx().insert(bodySessionSets).values({
      userId: uid(),
      sessionId,
      exerciseId: input.exerciseId,
      setNumber: input.setNumber,
      weight: input.weight != null ? String(input.weight) : null,
      reps: input.reps ?? null,
      completed: input.completed ?? false,
    });
  }

  return sessionForDate(sessions[0].date);
}

export async function updateSessionSet(
  setId: string,
  input: {
    weight?: number | null;
    reps?: number | null;
    completed?: boolean;
  },
) {
  const existing = await tx()
    .select()
    .from(bodySessionSets)
    .where(
      and(eq(bodySessionSets.id, setId), eq(bodySessionSets.userId, uid())),
    )
    .limit(1);
  if (!existing[0]) throw new Error("Not found");

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (input.weight !== undefined) {
    patch.weight = input.weight != null ? String(input.weight) : null;
  }
  if (input.reps !== undefined) patch.reps = input.reps;
  if (input.completed !== undefined) patch.completed = input.completed;

  await tx()
    .update(bodySessionSets)
    .set(patch)
    .where(eq(bodySessionSets.id, setId));

  const session = await tx()
    .select()
    .from(bodySessions)
    .where(eq(bodySessions.id, existing[0].sessionId))
    .limit(1);
  return sessionForDate(session[0].date);
}

// --- Weigh-ins ---

export async function listWeighIns() {
  const rows = await tx()
    .select()
    .from(bodyWeighIns)
    .where(eq(bodyWeighIns.userId, uid()))
    .orderBy(desc(bodyWeighIns.date))
    .limit(60);
  return {
    weighIns: rows.map((row) => ({
      id: row.id,
      date: row.date,
      weightLbs: Number(row.weightLbs),
      notes: row.notes,
    })),
  };
}

export async function createWeighIn(input: {
  date: string;
  weightLbs: number;
  notes?: string;
}) {
  const existing = await tx()
    .select()
    .from(bodyWeighIns)
    .where(
      and(eq(bodyWeighIns.userId, uid()), eq(bodyWeighIns.date, input.date)),
    )
    .limit(1);

  if (existing[0]) {
    const [row] = await tx()
      .update(bodyWeighIns)
      .set({
        weightLbs: String(input.weightLbs),
        notes: input.notes ?? null,
        updatedAt: new Date(),
      })
      .where(eq(bodyWeighIns.id, existing[0].id))
      .returning();
    return {
      weighIn: {
        id: row.id,
        date: row.date,
        weightLbs: Number(row.weightLbs),
        notes: row.notes,
      },
    };
  }

  const [row] = await tx()
    .insert(bodyWeighIns)
    .values({
      userId: uid(),
      date: input.date,
      weightLbs: String(input.weightLbs),
      notes: input.notes ?? null,
    })
    .returning();

  return {
    weighIn: {
      id: row.id,
      date: row.date,
      weightLbs: Number(row.weightLbs),
      notes: row.notes,
    },
  };
}

// --- Muscle rotation queue ---

async function ensureRotationSeeded() {
  const existing = await tx()
    .select()
    .from(bodyRotationSteps)
    .where(eq(bodyRotationSteps.userId, uid()))
    .limit(1);

  if (!existing[0]) {
    for (let i = 0; i < DEFAULT_ROTATION_STEPS.length; i++) {
      await tx().insert(bodyRotationSteps).values({
        userId: uid(),
        sortOrder: i,
        muscles: serializeMuscles(DEFAULT_ROTATION_STEPS[i]),
      });
    }
  }

  const stateRows = await tx()
    .select()
    .from(bodyRotationState)
    .where(eq(bodyRotationState.userId, uid()))
    .limit(1);
  if (!stateRows[0]) {
    await tx().insert(bodyRotationState).values({
      userId: uid(),
      nextIndex: 0,
      completedOn: null,
    });
  }
}

async function loadRotationSteps(): Promise<Muscle[][]> {
  await ensureRotationSeeded();
  const rows = await tx()
    .select()
    .from(bodyRotationSteps)
    .where(eq(bodyRotationSteps.userId, uid()))
    .orderBy(asc(bodyRotationSteps.sortOrder));
  return rows.map((r) => parseMuscles(r.muscles));
}

async function loadRotationState() {
  await ensureRotationSeeded();
  const rows = await tx()
    .select()
    .from(bodyRotationState)
    .where(eq(bodyRotationState.userId, uid()))
    .limit(1);
  const row = rows[0];
  return {
    nextIndex: row?.nextIndex ?? 0,
    completedOn: row?.completedOn ?? null,
  };
}

export async function getRotation() {
  const steps = await loadRotationSteps();
  const state = await loadRotationState();
  const rows = await tx()
    .select()
    .from(bodyRotationSteps)
    .where(eq(bodyRotationSteps.userId, uid()))
    .orderBy(asc(bodyRotationSteps.sortOrder));

  return {
    steps: rows.map((r, i) => ({
      id: r.id,
      sortOrder: r.sortOrder,
      muscles: steps[i] ?? parseMuscles(r.muscles),
    })),
    nextIndex: state.nextIndex,
    completedOn: state.completedOn,
    missingMuscles: missingMusclesFromSteps(steps),
  };
}

export async function putRotation(input: {
  steps: Array<{ muscles: string[] }>;
}) {
  if (!Array.isArray(input.steps) || input.steps.length === 0) {
    throw new Error("steps is required");
  }

  const cleaned = input.steps.map((step) => {
    const muscles = [...new Set(step.muscles.filter(isMuscle))];
    if (muscles.length === 0) {
      throw new Error("Each step needs at least one muscle");
    }
    return muscles;
  });

  await tx()
    .delete(bodyRotationSteps)
    .where(eq(bodyRotationSteps.userId, uid()));

  for (let i = 0; i < cleaned.length; i++) {
    await tx().insert(bodyRotationSteps).values({
      userId: uid(),
      sortOrder: i,
      muscles: serializeMuscles(cleaned[i]),
    });
  }

  const state = await loadRotationState();
  const nextIndex = state.nextIndex % cleaned.length;
  await tx()
    .update(bodyRotationState)
    .set({ nextIndex, updatedAt: new Date() })
    .where(eq(bodyRotationState.userId, uid()));

  return getRotation();
}

export async function getRotationAssignment(
  date: string,
  isTrainingDayFlag?: boolean,
): Promise<RotationAssignment> {
  const targets =
    isTrainingDayFlag === undefined ? await getTargets() : null;
  const training =
    isTrainingDayFlag ??
    isTrainingDay(targets!.trainingDays, weekdayFromDate(date));
  const steps = await loadRotationSteps();
  const state = await loadRotationState();
  return resolveRotationAssignment({
    isTrainingDay: training,
    steps,
    nextIndex: state.nextIndex,
    completedOn: state.completedOn,
    date,
  });
}

export async function completeRotation(date: string) {
  const steps = await loadRotationSteps();
  const state = await loadRotationState();
  const result = advanceRotation({
    nextIndex: state.nextIndex,
    completedOn: state.completedOn,
    date,
    stepCount: steps.length,
  });

  await tx()
    .update(bodyRotationState)
    .set({
      nextIndex: result.nextIndex,
      completedOn: result.completedOn,
      updatedAt: new Date(),
    })
    .where(eq(bodyRotationState.userId, uid()));

  const assignment = await getRotationAssignment(date);
  return { advanced: result.advanced, assignment, rotation: await getRotation() };
}

export async function undoRotation(date: string) {
  const steps = await loadRotationSteps();
  const state = await loadRotationState();
  const result = undoRotationCompletion({
    nextIndex: state.nextIndex,
    completedOn: state.completedOn,
    date,
    stepCount: steps.length,
  });

  await tx()
    .update(bodyRotationState)
    .set({
      nextIndex: result.nextIndex,
      completedOn: result.completedOn,
      updatedAt: new Date(),
    })
    .where(eq(bodyRotationState.userId, uid()));

  const assignment = await getRotationAssignment(date);
  return { undone: result.undone, assignment, rotation: await getRotation() };
}

export { EMPTY_MACROS };

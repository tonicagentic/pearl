import { and, desc, eq } from "drizzle-orm";

import type {
  BodyGroceryInput,
  BodyMealPlanInput,
  BodySessionInput,
  BodySettings,
} from "@/lib/body/validate";
import { db } from "@/lib/db/client";
import {
  bodyGrocery,
  bodyMealPlan,
  bodySession,
  bodySettings,
  type BodyGroceryRow,
  type BodyMealPlanRow,
  type BodySessionRow,
  type BodySettingsRow,
} from "@/lib/db/schema";

export type BodySettingsView = BodySettings & {
  updatedAt: string;
};

export type BodySessionView = BodySessionInput & {
  id: string;
  createdAt: string;
};

export type BodyMealPlanView = BodyMealPlanInput & {
  updatedAt: string;
};

export type BodyGroceryView = BodyGroceryInput & {
  updatedAt: string;
};

export type BodySnapshot = {
  settings: BodySettingsView | null;
  sessions: BodySessionView[];
  mealPlan: BodyMealPlanView | null;
  grocery: BodyGroceryView | null;
};

/** Calendar columns are YYYY-MM-DD strings. node-pg may hand back a Date. */
function calendarDate(value: string | Date): string {
  if (typeof value === "string") {
    return value.slice(0, 10);
  }
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${String(year)}-${month}-${day}`;
}

function timestampIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toSettings(row: BodySettingsRow): BodySettingsView {
  return {
    goal: row.goal as BodySettings["goal"],
    dietStyle: row.dietStyle as BodySettings["dietStyle"],
    trainingDays: row.trainingDays,
    split: row.split as BodySettings["split"],
    calorieTarget: row.calorieTarget,
    proteinTarget: row.proteinTarget,
    targetWeight: row.targetWeight,
    updatedAt: timestampIso(row.updatedAt),
  };
}

function toSession(row: BodySessionRow): BodySessionView {
  return {
    id: row.id,
    date: calendarDate(row.date),
    splitDayId: row.splitDayId,
    splitDayLabel: row.splitDayLabel,
    muscleGroups: row.muscleGroups,
    exercises: row.exercises,
    notes: row.notes,
    createdAt: timestampIso(row.createdAt),
  };
}

function toMealPlan(row: BodyMealPlanRow): BodyMealPlanView {
  return {
    weekStart: calendarDate(row.weekStart),
    days: row.days,
    updatedAt: timestampIso(row.updatedAt),
  };
}

function toGrocery(row: BodyGroceryRow): BodyGroceryView {
  return {
    weekStart: calendarDate(row.weekStart),
    items: row.items,
    updatedAt: timestampIso(row.updatedAt),
  };
}

export async function readBody(userId: string): Promise<BodySnapshot> {
  const [settingsRows, sessionRows, mealPlanRows, groceryRows] = await Promise.all([
    db
      .select()
      .from(bodySettings)
      .where(eq(bodySettings.userId, userId))
      .limit(1),
    db
      .select()
      .from(bodySession)
      .where(eq(bodySession.userId, userId))
      .orderBy(desc(bodySession.date), desc(bodySession.createdAt))
      .limit(40),
    db
      .select()
      .from(bodyMealPlan)
      .where(eq(bodyMealPlan.userId, userId))
      .limit(1),
    db
      .select()
      .from(bodyGrocery)
      .where(eq(bodyGrocery.userId, userId))
      .limit(1),
  ]);

  const settings = settingsRows[0];
  const mealPlan = mealPlanRows[0];
  const grocery = groceryRows[0];

  return {
    settings: settings ? toSettings(settings) : null,
    sessions: sessionRows.map((row) => toSession(row)),
    mealPlan: mealPlan ? toMealPlan(mealPlan) : null,
    grocery: grocery ? toGrocery(grocery) : null,
  };
}

export async function upsertBodySettings(
  userId: string,
  settings: BodySettings,
): Promise<void> {
  const updatedAt = new Date();
  await db
    .insert(bodySettings)
    .values({
      userId,
      ...settings,
      updatedAt,
    })
    .onConflictDoUpdate({
      target: bodySettings.userId,
      set: {
        ...settings,
        updatedAt,
      },
    });
}

export async function insertBodySession(
  userId: string,
  session: BodySessionInput,
): Promise<void> {
  await db.insert(bodySession).values({
    userId,
    date: session.date,
    splitDayId: session.splitDayId,
    splitDayLabel: session.splitDayLabel,
    muscleGroups: session.muscleGroups,
    exercises: session.exercises,
    notes: session.notes,
  });
}

/** Deletes the session when it belongs to userId. Returns false otherwise. */
export async function deleteBodySession(
  userId: string,
  id: string,
): Promise<boolean> {
  const deleted = await db
    .delete(bodySession)
    .where(and(eq(bodySession.userId, userId), eq(bodySession.id, id)))
    .returning({ id: bodySession.id });
  return deleted.length > 0;
}

export async function upsertBodyMealPlan(
  userId: string,
  plan: BodyMealPlanInput,
): Promise<void> {
  const updatedAt = new Date();
  await db
    .insert(bodyMealPlan)
    .values({
      userId,
      weekStart: plan.weekStart,
      days: plan.days,
      updatedAt,
    })
    .onConflictDoUpdate({
      target: bodyMealPlan.userId,
      set: {
        weekStart: plan.weekStart,
        days: plan.days,
        updatedAt,
      },
    });
}

export async function upsertBodyGrocery(
  userId: string,
  grocery: BodyGroceryInput,
): Promise<void> {
  const updatedAt = new Date();
  await db
    .insert(bodyGrocery)
    .values({
      userId,
      weekStart: grocery.weekStart,
      items: grocery.items,
      updatedAt,
    })
    .onConflictDoUpdate({
      target: bodyGrocery.userId,
      set: {
        weekStart: grocery.weekStart,
        items: grocery.items,
        updatedAt,
      },
    });
}

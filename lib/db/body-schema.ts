import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  numeric,
  pgSchema,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { user } from "./schema.ts";

/**
 * Pearl Body nutrition + training ledger.
 *
 * - Lives in the dedicated `body` Postgres schema so names don't collide with
 *   `public.*` Pearl tables. All TS exports are prefixed with `body`.
 * - Every table carries `user_id` (FK -> public.user, cascade) so row-level
 *   security can be enforced without joins (see lib/db/migrations/0038_body_schema.sql).
 * - Meal log items snapshot food name/macros so later food edits don't rewrite history.
 */
export const body = pgSchema("body");

const id = () =>
  text("id")
    .primaryKey()
    .default(sql`gen_random_uuid()::text`);

const userId = () =>
  text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" });

const macros = {
  calories: () => numeric("calories", { precision: 10, scale: 2 }).notNull(),
  proteinG: () => numeric("protein_g", { precision: 10, scale: 2 }).notNull(),
  carbsG: () => numeric("carbs_g", { precision: 10, scale: 2 }).notNull(),
  fatG: () => numeric("fat_g", { precision: 10, scale: 2 }).notNull(),
};

const createdAt = () => timestamp("created_at").defaultNow().notNull();

const updatedAt = () =>
  timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull();

/** One row per user: daily calorie/macro targets and training weekdays (0=Sun..6=Sat). */
export const bodyTargets = body.table("targets", {
  id: id(),
  userId: userId(),
  calories: macros.calories(),
  proteinG: macros.proteinG(),
  carbsG: macros.carbsG(),
  fatG: macros.fatG(),
  /** JSON array of weekday ints 0–6, e.g. "[1,3,5]" */
  trainingDays: text("training_days").notNull().default("[]"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [unique("targets_user_id_unique").on(t.userId)]);

export const bodyFoods = body.table(
  "foods",
  {
    id: id(),
    userId: userId(),
    name: text("name").notNull(),
    servingLabel: text("serving_label").notNull().default("1 serving"),
    /** breakfast | lunch | dinner | snack — null until set */
    slot: text("slot"),
    /** UPC/EAN barcode when known */
    barcode: text("barcode"),
    calories: macros.calories(),
    proteinG: macros.proteinG(),
    carbsG: macros.carbsG(),
    fatG: macros.fatG(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("foods_user_id_idx").on(t.userId),
    uniqueIndex("foods_user_barcode_unique")
      .on(t.userId, t.barcode)
      .where(sql`${t.barcode} is not null`),
  ],
);

export const bodyMealLogs = body.table(
  "meal_logs",
  {
    id: id(),
    userId: userId(),
    date: date("date").notNull(),
    /** breakfast | lunch | dinner | snack */
    slot: text("slot").notNull(),
    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("meal_logs_user_date_idx").on(t.userId, t.date),
    index("meal_logs_user_id_idx").on(t.userId),
  ],
);

export const bodyMealLogItems = body.table(
  "meal_log_items",
  {
    id: id(),
    userId: userId(),
    mealLogId: text("meal_log_id")
      .notNull()
      .references(() => bodyMealLogs.id, { onDelete: "cascade" }),
    foodId: text("food_id").references(() => bodyFoods.id, {
      onDelete: "set null",
    }),
    /** Snapshotted food name at log time */
    name: text("name").notNull(),
    servings: numeric("servings", { precision: 10, scale: 2 }).notNull().default("1"),
    calories: macros.calories(),
    proteinG: macros.proteinG(),
    carbsG: macros.carbsG(),
    fatG: macros.fatG(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("meal_log_items_user_id_idx").on(t.userId),
    index("meal_log_items_meal_log_id_idx").on(t.mealLogId),
  ],
);

export const bodyMealPlans = body.table(
  "meal_plans",
  {
    id: id(),
    userId: userId(),
    name: text("name").notNull().default("Weekly plan"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("meal_plans_user_id_idx").on(t.userId)],
);

export const bodyPlannedMeals = body.table(
  "planned_meals",
  {
    id: id(),
    userId: userId(),
    mealPlanId: text("meal_plan_id")
      .notNull()
      .references(() => bodyMealPlans.id, { onDelete: "cascade" }),
    /** 0=Sun .. 6=Sat */
    weekday: integer("weekday").notNull(),
    /** breakfast | lunch | dinner | snack */
    slot: text("slot").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("planned_meals_user_id_idx").on(t.userId),
    index("planned_meals_plan_weekday_idx").on(t.mealPlanId, t.weekday),
    unique("planned_meals_plan_weekday_slot_unique").on(
      t.mealPlanId,
      t.weekday,
      t.slot,
    ),
  ],
);

export const bodyPlannedMealItems = body.table(
  "planned_meal_items",
  {
    id: id(),
    userId: userId(),
    plannedMealId: text("planned_meal_id")
      .notNull()
      .references(() => bodyPlannedMeals.id, { onDelete: "cascade" }),
    foodId: text("food_id")
      .notNull()
      .references(() => bodyFoods.id, { onDelete: "cascade" }),
    servings: numeric("servings", { precision: 10, scale: 2 }).notNull().default("1"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("planned_meal_items_user_id_idx").on(t.userId),
    index("planned_meal_items_planned_meal_id_idx").on(t.plannedMealId),
  ],
);

export const bodyExercises = body.table(
  "exercises",
  {
    id: id(),
    userId: userId(),
    name: text("name").notNull(),
    muscleGroup: text("muscle_group"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("exercises_user_id_idx").on(t.userId)],
);

export const bodyPrograms = body.table(
  "programs",
  {
    id: id(),
    userId: userId(),
    name: text("name").notNull().default("Training program"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("programs_user_id_idx").on(t.userId)],
);

export const bodyProgramDays = body.table(
  "program_days",
  {
    id: id(),
    userId: userId(),
    programId: text("program_id")
      .notNull()
      .references(() => bodyPrograms.id, { onDelete: "cascade" }),
    /** 0=Sun .. 6=Sat */
    weekday: integer("weekday").notNull(),
    name: text("name"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("program_days_user_id_idx").on(t.userId),
    index("program_days_program_id_idx").on(t.programId),
    unique("program_days_program_weekday_unique").on(t.programId, t.weekday),
  ],
);

export const bodyProgramExercises = body.table(
  "program_exercises",
  {
    id: id(),
    userId: userId(),
    programDayId: text("program_day_id")
      .notNull()
      .references(() => bodyProgramDays.id, { onDelete: "cascade" }),
    exerciseId: text("exercise_id")
      .notNull()
      .references(() => bodyExercises.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(0),
    plannedSets: integer("planned_sets").notNull().default(3),
    plannedReps: integer("planned_reps").notNull().default(8),
    targetWeight: numeric("target_weight", { precision: 10, scale: 2 }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("program_exercises_user_id_idx").on(t.userId),
    index("program_exercises_program_day_id_idx").on(t.programDayId),
  ],
);

export const bodySessions = body.table(
  "sessions",
  {
    id: id(),
    userId: userId(),
    date: date("date").notNull(),
    programDayId: text("program_day_id").references(() => bodyProgramDays.id, {
      onDelete: "set null",
    }),
    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("sessions_user_date_idx").on(t.userId, t.date),
    index("sessions_user_id_idx").on(t.userId),
  ],
);

export const bodySessionSets = body.table(
  "session_sets",
  {
    id: id(),
    userId: userId(),
    sessionId: text("session_id")
      .notNull()
      .references(() => bodySessions.id, { onDelete: "cascade" }),
    exerciseId: text("exercise_id")
      .notNull()
      .references(() => bodyExercises.id, { onDelete: "cascade" }),
    setNumber: integer("set_number").notNull().default(1),
    weight: numeric("weight", { precision: 10, scale: 2 }),
    reps: integer("reps"),
    completed: boolean("completed").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("session_sets_user_id_idx").on(t.userId),
    index("session_sets_session_id_idx").on(t.sessionId),
  ],
);

export const bodyWeighIns = body.table(
  "weigh_ins",
  {
    id: id(),
    userId: userId(),
    date: date("date").notNull(),
    weightLbs: numeric("weight_lbs", { precision: 10, scale: 2 }).notNull(),
    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("weigh_ins_user_date_idx").on(t.userId, t.date),
    unique("weigh_ins_user_date_unique").on(t.userId, t.date),
  ],
);

/** Ordered muscle-group steps for the training queue. */
export const bodyRotationSteps = body.table(
  "rotation_steps",
  {
    id: id(),
    userId: userId(),
    sortOrder: integer("sort_order").notNull().default(0),
    /** JSON array of muscle ids, e.g. '["chest","shoulders","triceps"]' */
    muscles: text("muscles").notNull().default("[]"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("rotation_steps_user_id_idx").on(t.userId),
    index("rotation_steps_user_sort_idx").on(t.userId, t.sortOrder),
  ],
);

/** One row per user: next queue index and last completion date. */
export const bodyRotationState = body.table(
  "rotation_state",
  {
    id: id(),
    userId: userId(),
    nextIndex: integer("next_index").notNull().default(0),
    completedOn: date("completed_on"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [unique("rotation_state_user_id_unique").on(t.userId)],
);

export type BodyTargets = typeof bodyTargets.$inferSelect;
export type BodyFood = typeof bodyFoods.$inferSelect;
export type BodyMealLog = typeof bodyMealLogs.$inferSelect;
export type BodyMealLogItem = typeof bodyMealLogItems.$inferSelect;
export type BodyMealPlan = typeof bodyMealPlans.$inferSelect;
export type BodyExercise = typeof bodyExercises.$inferSelect;
export type BodyProgram = typeof bodyPrograms.$inferSelect;
export type BodySession = typeof bodySessions.$inferSelect;
export type BodyWeighIn = typeof bodyWeighIns.$inferSelect;
export type BodyRotationStep = typeof bodyRotationSteps.$inferSelect;
export type BodyRotationState = typeof bodyRotationState.$inferSelect;

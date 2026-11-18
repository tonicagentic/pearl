-- Pearl Body (agent Pearl): dedicated `body` schema, tables, RLS, body_app role.
-- Hand-reviewed to match db/schema/body.ts. Safe to run once; do not db:push this schema to production.
CREATE SCHEMA IF NOT EXISTS "body";
--> statement-breakpoint
CREATE TABLE "body"."targets" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"user_id" text NOT NULL,
	"calories" numeric(10, 2) NOT NULL,
	"protein_g" numeric(10, 2) NOT NULL,
	"carbs_g" numeric(10, 2) NOT NULL,
	"fat_g" numeric(10, 2) NOT NULL,
	"training_days" text DEFAULT '[]' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "targets_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "body"."foods" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"serving_label" text DEFAULT '1 serving' NOT NULL,
	"calories" numeric(10, 2) NOT NULL,
	"protein_g" numeric(10, 2) NOT NULL,
	"carbs_g" numeric(10, 2) NOT NULL,
	"fat_g" numeric(10, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "body"."meal_logs" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"user_id" text NOT NULL,
	"date" date NOT NULL,
	"slot" text NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "body"."meal_log_items" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"user_id" text NOT NULL,
	"meal_log_id" text NOT NULL,
	"food_id" text,
	"name" text NOT NULL,
	"servings" numeric(10, 2) DEFAULT '1' NOT NULL,
	"calories" numeric(10, 2) NOT NULL,
	"protein_g" numeric(10, 2) NOT NULL,
	"carbs_g" numeric(10, 2) NOT NULL,
	"fat_g" numeric(10, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "body"."meal_plans" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"user_id" text NOT NULL,
	"name" text DEFAULT 'Weekly plan' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "body"."planned_meals" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"user_id" text NOT NULL,
	"meal_plan_id" text NOT NULL,
	"weekday" integer NOT NULL,
	"slot" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "planned_meals_plan_weekday_slot_unique" UNIQUE("meal_plan_id","weekday","slot")
);
--> statement-breakpoint
CREATE TABLE "body"."planned_meal_items" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"user_id" text NOT NULL,
	"planned_meal_id" text NOT NULL,
	"food_id" text NOT NULL,
	"servings" numeric(10, 2) DEFAULT '1' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "body"."exercises" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"muscle_group" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "body"."programs" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"user_id" text NOT NULL,
	"name" text DEFAULT 'Training program' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "body"."program_days" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"user_id" text NOT NULL,
	"program_id" text NOT NULL,
	"weekday" integer NOT NULL,
	"name" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "program_days_program_weekday_unique" UNIQUE("program_id","weekday")
);
--> statement-breakpoint
CREATE TABLE "body"."program_exercises" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"user_id" text NOT NULL,
	"program_day_id" text NOT NULL,
	"exercise_id" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"planned_sets" integer DEFAULT 3 NOT NULL,
	"planned_reps" integer DEFAULT 8 NOT NULL,
	"target_weight" numeric(10, 2),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "body"."sessions" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"user_id" text NOT NULL,
	"date" date NOT NULL,
	"program_day_id" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "body"."session_sets" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"user_id" text NOT NULL,
	"session_id" text NOT NULL,
	"exercise_id" text NOT NULL,
	"set_number" integer DEFAULT 1 NOT NULL,
	"weight" numeric(10, 2),
	"reps" integer,
	"completed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "body"."weigh_ins" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"user_id" text NOT NULL,
	"date" date NOT NULL,
	"weight_lbs" numeric(10, 2) NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "weigh_ins_user_date_unique" UNIQUE("user_id","date")
);
--> statement-breakpoint
ALTER TABLE "body"."targets" ADD CONSTRAINT "targets_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "body"."foods" ADD CONSTRAINT "foods_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "body"."meal_logs" ADD CONSTRAINT "meal_logs_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "body"."meal_log_items" ADD CONSTRAINT "meal_log_items_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "body"."meal_log_items" ADD CONSTRAINT "meal_log_items_meal_log_id_meal_logs_id_fk" FOREIGN KEY ("meal_log_id") REFERENCES "body"."meal_logs"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "body"."meal_log_items" ADD CONSTRAINT "meal_log_items_food_id_foods_id_fk" FOREIGN KEY ("food_id") REFERENCES "body"."foods"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "body"."meal_plans" ADD CONSTRAINT "meal_plans_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "body"."planned_meals" ADD CONSTRAINT "planned_meals_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "body"."planned_meals" ADD CONSTRAINT "planned_meals_meal_plan_id_meal_plans_id_fk" FOREIGN KEY ("meal_plan_id") REFERENCES "body"."meal_plans"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "body"."planned_meal_items" ADD CONSTRAINT "planned_meal_items_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "body"."planned_meal_items" ADD CONSTRAINT "planned_meal_items_planned_meal_id_planned_meals_id_fk" FOREIGN KEY ("planned_meal_id") REFERENCES "body"."planned_meals"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "body"."planned_meal_items" ADD CONSTRAINT "planned_meal_items_food_id_foods_id_fk" FOREIGN KEY ("food_id") REFERENCES "body"."foods"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "body"."exercises" ADD CONSTRAINT "exercises_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "body"."programs" ADD CONSTRAINT "programs_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "body"."program_days" ADD CONSTRAINT "program_days_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "body"."program_days" ADD CONSTRAINT "program_days_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "body"."programs"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "body"."program_exercises" ADD CONSTRAINT "program_exercises_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "body"."program_exercises" ADD CONSTRAINT "program_exercises_program_day_id_program_days_id_fk" FOREIGN KEY ("program_day_id") REFERENCES "body"."program_days"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "body"."program_exercises" ADD CONSTRAINT "program_exercises_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "body"."exercises"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "body"."sessions" ADD CONSTRAINT "sessions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "body"."sessions" ADD CONSTRAINT "sessions_program_day_id_program_days_id_fk" FOREIGN KEY ("program_day_id") REFERENCES "body"."program_days"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "body"."session_sets" ADD CONSTRAINT "session_sets_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "body"."session_sets" ADD CONSTRAINT "session_sets_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "body"."sessions"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "body"."session_sets" ADD CONSTRAINT "session_sets_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "body"."exercises"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "body"."weigh_ins" ADD CONSTRAINT "weigh_ins_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "foods_user_id_idx" ON "body"."foods" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "meal_logs_user_date_idx" ON "body"."meal_logs" USING btree ("user_id","date");
--> statement-breakpoint
CREATE INDEX "meal_logs_user_id_idx" ON "body"."meal_logs" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "meal_log_items_user_id_idx" ON "body"."meal_log_items" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "meal_log_items_meal_log_id_idx" ON "body"."meal_log_items" USING btree ("meal_log_id");
--> statement-breakpoint
CREATE INDEX "meal_plans_user_id_idx" ON "body"."meal_plans" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "planned_meals_user_id_idx" ON "body"."planned_meals" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "planned_meals_plan_weekday_idx" ON "body"."planned_meals" USING btree ("meal_plan_id","weekday");
--> statement-breakpoint
CREATE INDEX "planned_meal_items_user_id_idx" ON "body"."planned_meal_items" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "planned_meal_items_planned_meal_id_idx" ON "body"."planned_meal_items" USING btree ("planned_meal_id");
--> statement-breakpoint
CREATE INDEX "exercises_user_id_idx" ON "body"."exercises" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "programs_user_id_idx" ON "body"."programs" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "program_days_user_id_idx" ON "body"."program_days" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "program_days_program_id_idx" ON "body"."program_days" USING btree ("program_id");
--> statement-breakpoint
CREATE INDEX "program_exercises_user_id_idx" ON "body"."program_exercises" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "program_exercises_program_day_id_idx" ON "body"."program_exercises" USING btree ("program_day_id");
--> statement-breakpoint
CREATE INDEX "sessions_user_date_idx" ON "body"."sessions" USING btree ("user_id","date");
--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "body"."sessions" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "session_sets_user_id_idx" ON "body"."session_sets" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "session_sets_session_id_idx" ON "body"."session_sets" USING btree ("session_id");
--> statement-breakpoint
CREATE INDEX "weigh_ins_user_date_idx" ON "body"."weigh_ins" USING btree ("user_id","date");
--> statement-breakpoint
ALTER TABLE "body"."targets" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY user_isolation ON "body"."targets" USING (user_id = current_setting('app.user_id', true)) WITH CHECK (user_id = current_setting('app.user_id', true));
--> statement-breakpoint
ALTER TABLE "body"."foods" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY user_isolation ON "body"."foods" USING (user_id = current_setting('app.user_id', true)) WITH CHECK (user_id = current_setting('app.user_id', true));
--> statement-breakpoint
ALTER TABLE "body"."meal_logs" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY user_isolation ON "body"."meal_logs" USING (user_id = current_setting('app.user_id', true)) WITH CHECK (user_id = current_setting('app.user_id', true));
--> statement-breakpoint
ALTER TABLE "body"."meal_log_items" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY user_isolation ON "body"."meal_log_items" USING (user_id = current_setting('app.user_id', true)) WITH CHECK (user_id = current_setting('app.user_id', true));
--> statement-breakpoint
ALTER TABLE "body"."meal_plans" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY user_isolation ON "body"."meal_plans" USING (user_id = current_setting('app.user_id', true)) WITH CHECK (user_id = current_setting('app.user_id', true));
--> statement-breakpoint
ALTER TABLE "body"."planned_meals" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY user_isolation ON "body"."planned_meals" USING (user_id = current_setting('app.user_id', true)) WITH CHECK (user_id = current_setting('app.user_id', true));
--> statement-breakpoint
ALTER TABLE "body"."planned_meal_items" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY user_isolation ON "body"."planned_meal_items" USING (user_id = current_setting('app.user_id', true)) WITH CHECK (user_id = current_setting('app.user_id', true));
--> statement-breakpoint
ALTER TABLE "body"."exercises" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY user_isolation ON "body"."exercises" USING (user_id = current_setting('app.user_id', true)) WITH CHECK (user_id = current_setting('app.user_id', true));
--> statement-breakpoint
ALTER TABLE "body"."programs" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY user_isolation ON "body"."programs" USING (user_id = current_setting('app.user_id', true)) WITH CHECK (user_id = current_setting('app.user_id', true));
--> statement-breakpoint
ALTER TABLE "body"."program_days" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY user_isolation ON "body"."program_days" USING (user_id = current_setting('app.user_id', true)) WITH CHECK (user_id = current_setting('app.user_id', true));
--> statement-breakpoint
ALTER TABLE "body"."program_exercises" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY user_isolation ON "body"."program_exercises" USING (user_id = current_setting('app.user_id', true)) WITH CHECK (user_id = current_setting('app.user_id', true));
--> statement-breakpoint
ALTER TABLE "body"."sessions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY user_isolation ON "body"."sessions" USING (user_id = current_setting('app.user_id', true)) WITH CHECK (user_id = current_setting('app.user_id', true));
--> statement-breakpoint
ALTER TABLE "body"."session_sets" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY user_isolation ON "body"."session_sets" USING (user_id = current_setting('app.user_id', true)) WITH CHECK (user_id = current_setting('app.user_id', true));
--> statement-breakpoint
ALTER TABLE "body"."weigh_ins" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY user_isolation ON "body"."weigh_ins" USING (user_id = current_setting('app.user_id', true)) WITH CHECK (user_id = current_setting('app.user_id', true));
--> statement-breakpoint
DO $$ BEGIN
  CREATE ROLE body_app LOGIN;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
GRANT USAGE ON SCHEMA body TO body_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA body TO body_app;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA body GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO body_app;

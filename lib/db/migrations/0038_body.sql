CREATE TABLE "body_grocery" (
	"user_id" text PRIMARY KEY NOT NULL,
	"week_start" date NOT NULL,
	"items" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "body_meal_plan" (
	"user_id" text PRIMARY KEY NOT NULL,
	"week_start" date NOT NULL,
	"days" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "body_session" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"date" date NOT NULL,
	"split_day_id" text NOT NULL,
	"split_day_label" text NOT NULL,
	"muscle_groups" jsonb NOT NULL,
	"exercises" jsonb NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "body_settings" (
	"user_id" text PRIMARY KEY NOT NULL,
	"goal" text NOT NULL,
	"diet_style" text NOT NULL,
	"training_days" jsonb NOT NULL,
	"split" text NOT NULL,
	"calorie_target" integer NOT NULL,
	"protein_target" integer NOT NULL,
	"target_weight" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "body_grocery" ADD CONSTRAINT "body_grocery_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "body_meal_plan" ADD CONSTRAINT "body_meal_plan_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "body_session" ADD CONSTRAINT "body_session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "body_settings" ADD CONSTRAINT "body_settings_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_body_session_user_date" ON "body_session" USING btree ("user_id","date");
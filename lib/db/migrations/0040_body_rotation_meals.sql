-- Pearl Body: meal category on foods + muscle rotation queue tables.
ALTER TABLE "body"."foods" ADD COLUMN "slot" text;
--> statement-breakpoint
CREATE TABLE "body"."rotation_steps" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"user_id" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"muscles" text DEFAULT '[]' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "body"."rotation_state" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"user_id" text NOT NULL,
	"next_index" integer DEFAULT 0 NOT NULL,
	"completed_on" date,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "rotation_state_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "body"."rotation_steps" ADD CONSTRAINT "rotation_steps_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "body"."rotation_state" ADD CONSTRAINT "rotation_state_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "rotation_steps_user_id_idx" ON "body"."rotation_steps" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "rotation_steps_user_sort_idx" ON "body"."rotation_steps" USING btree ("user_id","sort_order");
--> statement-breakpoint
ALTER TABLE "body"."rotation_steps" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY user_isolation ON "body"."rotation_steps" USING (user_id = current_setting('app.user_id', true)) WITH CHECK (user_id = current_setting('app.user_id', true));
--> statement-breakpoint
ALTER TABLE "body"."rotation_state" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY user_isolation ON "body"."rotation_state" USING (user_id = current_setting('app.user_id', true)) WITH CHECK (user_id = current_setting('app.user_id', true));

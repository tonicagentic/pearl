CREATE TABLE "workbench_pin" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"owner" text NOT NULL,
	"name" text NOT NULL,
	"vercel_project_id" text,
	"vercel_team_id" text,
	"expo_project_id" text,
	"expo_update_channel" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat" ADD COLUMN "previews" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "workbench_pin" ADD CONSTRAINT "workbench_pin_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_workbench_pin_user" ON "workbench_pin" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_workbench_pin_user_owner_name" ON "workbench_pin" USING btree ("user_id","owner","name");
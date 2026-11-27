CREATE TABLE "pearl_automation" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"instructions" text NOT NULL,
	"trigger_kind" text NOT NULL,
	"trigger_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"timezone" text DEFAULT 'America/Los_Angeles' NOT NULL,
	"notify_push" boolean DEFAULT true NOT NULL,
	"notify_email" boolean DEFAULT true NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"eve_schedule_name" text NOT NULL,
	"last_chat_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pearl_automation" ADD CONSTRAINT "pearl_automation_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pearl_automation" ADD CONSTRAINT "pearl_automation_last_chat_id_chat_id_fk" FOREIGN KEY ("last_chat_id") REFERENCES "public"."chat"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_pearl_automation_user" ON "pearl_automation" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_pearl_automation_eve_name" ON "pearl_automation" USING btree ("eve_schedule_name");--> statement-breakpoint
CREATE INDEX "idx_pearl_automation_user_enabled" ON "pearl_automation" USING btree ("user_id","enabled");

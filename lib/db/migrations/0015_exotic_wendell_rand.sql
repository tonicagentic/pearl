CREATE TABLE "user_skill" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"markdown" text NOT NULL,
	"files" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"source" text DEFAULT 'custom' NOT NULL,
	"registry_name" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_skill" ADD CONSTRAINT "user_skill_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_user_skill_user" ON "user_skill" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_user_skill_user_slug" ON "user_skill" USING btree ("user_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_user_skill_user_registry" ON "user_skill" USING btree ("user_id","registry_name");
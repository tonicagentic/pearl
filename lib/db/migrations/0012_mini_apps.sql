CREATE TABLE "mini_app" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"github_owner" text NOT NULL,
	"github_repo" text NOT NULL,
	"fx_session_id" text,
	"sandbox_name" text NOT NULL,
	"vercel_project_id" text,
	"production_url" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mini_app" ADD CONSTRAINT "mini_app_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_mini_app_user" ON "mini_app" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_mini_app_user_slug" ON "mini_app" USING btree ("user_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_mini_app_github" ON "mini_app" USING btree ("github_owner","github_repo");
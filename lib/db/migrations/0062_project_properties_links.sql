ALTER TABLE "project" ADD COLUMN "status" text DEFAULT 'backlog' NOT NULL;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "priority" text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "start_date" date;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "target_date" date;--> statement-breakpoint
CREATE TABLE "project_link" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"url" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project_link" ADD CONSTRAINT "project_link_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_link" ADD CONSTRAINT "project_link_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_project_link_project" ON "project_link" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_project_link_user" ON "project_link" USING btree ("user_id");

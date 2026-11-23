CREATE TABLE "project_artifact" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"user_id" text NOT NULL,
	"pathname" text NOT NULL,
	"title" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project_artifact" ADD CONSTRAINT "project_artifact_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_artifact" ADD CONSTRAINT "project_artifact_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_project_artifact_project" ON "project_artifact" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_project_artifact_user" ON "project_artifact" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_project_artifact_project_pathname" ON "project_artifact" USING btree ("project_id","pathname");

CREATE TABLE "capability" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"summary" text NOT NULL,
	"audience" text,
	"proof" text,
	"status" text DEFAULT 'active' NOT NULL,
	"project_id" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "capability" ADD CONSTRAINT "capability_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capability" ADD CONSTRAINT "capability_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_capability_user" ON "capability" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_capability_user_status" ON "capability" USING btree ("user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_capability_user_name" ON "capability" USING btree ("user_id",lower("name"));

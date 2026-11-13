CREATE TABLE "project_pin" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"pin_id" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project_pin" ADD CONSTRAINT "project_pin_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_pin" ADD CONSTRAINT "project_pin_pin_id_workbench_pin_id_fk" FOREIGN KEY ("pin_id") REFERENCES "public"."workbench_pin"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_project_pin_project" ON "project_pin" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_project_pin_pin" ON "project_pin" USING btree ("pin_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_project_pin_project_pin" ON "project_pin" USING btree ("project_id","pin_id");

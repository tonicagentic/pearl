CREATE TABLE "issue" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"responsibility_id" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"due_date" date,
	"review_date" date,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "responsibility" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"parent_id" text,
	"sort_index" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "issue" ADD CONSTRAINT "issue_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue" ADD CONSTRAINT "issue_responsibility_id_responsibility_id_fk" FOREIGN KEY ("responsibility_id") REFERENCES "public"."responsibility"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "responsibility" ADD CONSTRAINT "responsibility_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "responsibility" ADD CONSTRAINT "responsibility_parent_id_responsibility_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."responsibility"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_issue_user_status" ON "issue" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "idx_responsibility_user" ON "responsibility" USING btree ("user_id");
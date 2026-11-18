CREATE TABLE "task_list" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"project_id" text,
	"cadence" text,
	"weekday" integer,
	"month_day" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_list_item" (
	"id" text PRIMARY KEY NOT NULL,
	"list_id" text NOT NULL,
	"title" text NOT NULL,
	"notes" text,
	"sort_index" integer DEFAULT 0 NOT NULL,
	"checked_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "issue" ADD COLUMN "list_id" text;--> statement-breakpoint
ALTER TABLE "issue" ADD COLUMN "list_item_id" text;--> statement-breakpoint
ALTER TABLE "issue" ADD COLUMN "list_occurrence" date;--> statement-breakpoint
ALTER TABLE "task_list" ADD CONSTRAINT "task_list_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_list" ADD CONSTRAINT "task_list_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_list_item" ADD CONSTRAINT "task_list_item_list_id_task_list_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."task_list"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue" ADD CONSTRAINT "issue_list_id_task_list_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."task_list"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue" ADD CONSTRAINT "issue_list_item_id_task_list_item_id_fk" FOREIGN KEY ("list_item_id") REFERENCES "public"."task_list_item"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_task_list_user" ON "task_list" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_task_list_scheduled" ON "task_list" USING btree ("user_id","cadence");--> statement-breakpoint
CREATE INDEX "idx_task_list_item_list" ON "task_list_item" USING btree ("list_id","sort_index");--> statement-breakpoint
CREATE INDEX "idx_issue_list_item_open" ON "issue" USING btree ("list_item_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_issue_list_item_occurrence" ON "issue" USING btree ("list_item_id","list_occurrence") WHERE "list_item_id" is not null and "list_occurrence" is not null;

ALTER TABLE "chat" ADD COLUMN "goal_id" text;--> statement-breakpoint
ALTER TABLE "issue" ADD COLUMN "goal_id" text;--> statement-breakpoint
ALTER TABLE "project_note" ADD COLUMN "goal_id" text;--> statement-breakpoint
ALTER TABLE "chat" ADD CONSTRAINT "chat_goal_id_project_goal_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."project_goal"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue" ADD CONSTRAINT "issue_goal_id_project_goal_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."project_goal"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_note" ADD CONSTRAINT "project_note_goal_id_project_goal_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."project_goal"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_chat_goal" ON "chat" USING btree ("goal_id");--> statement-breakpoint
CREATE INDEX "idx_issue_user_goal" ON "issue" USING btree ("user_id","goal_id");--> statement-breakpoint
CREATE INDEX "idx_project_note_goal" ON "project_note" USING btree ("goal_id");--> statement-breakpoint
CREATE TABLE "project_label" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT 'gray' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_label_assignment" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"label_id" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project_label" ADD CONSTRAINT "project_label_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_label_assignment" ADD CONSTRAINT "project_label_assignment_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_label_assignment" ADD CONSTRAINT "project_label_assignment_label_id_project_label_id_fk" FOREIGN KEY ("label_id") REFERENCES "public"."project_label"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_label_assignment" ADD CONSTRAINT "project_label_assignment_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_project_label_user" ON "project_label" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_project_label_user_name" ON "project_label" USING btree ("user_id",lower("name"));--> statement-breakpoint
CREATE INDEX "idx_project_label_assignment_project" ON "project_label_assignment" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_project_label_assignment_label" ON "project_label_assignment" USING btree ("label_id");--> statement-breakpoint
CREATE INDEX "idx_project_label_assignment_user" ON "project_label_assignment" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_project_label_assignment_unique" ON "project_label_assignment" USING btree ("project_id","label_id");

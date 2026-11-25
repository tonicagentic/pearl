ALTER TABLE "project_goal" DROP CONSTRAINT IF EXISTS "project_goal_project_id_project_id_fk";--> statement-breakpoint
ALTER TABLE "project_note" DROP CONSTRAINT IF EXISTS "project_note_project_id_project_id_fk";--> statement-breakpoint
ALTER TABLE "project_goal" ALTER COLUMN "project_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "project_note" ALTER COLUMN "project_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "project_goal" ADD CONSTRAINT "project_goal_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_note" ADD CONSTRAINT "project_note_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE set null ON UPDATE no action;

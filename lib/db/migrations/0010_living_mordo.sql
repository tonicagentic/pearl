ALTER TABLE "responsibility" RENAME TO "area";--> statement-breakpoint
ALTER TABLE "issue" RENAME COLUMN "responsibility_id" TO "area_id";--> statement-breakpoint
ALTER TABLE "issue" DROP CONSTRAINT "issue_responsibility_id_responsibility_id_fk";
--> statement-breakpoint
ALTER TABLE "area" DROP CONSTRAINT "responsibility_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "area" DROP CONSTRAINT "responsibility_parent_id_responsibility_id_fk";
--> statement-breakpoint
DROP INDEX "idx_responsibility_user";--> statement-breakpoint
DROP INDEX "idx_responsibility_sibling_name";--> statement-breakpoint
ALTER TABLE "issue" ADD CONSTRAINT "issue_area_id_area_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."area"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "area" ADD CONSTRAINT "area_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "area" ADD CONSTRAINT "area_parent_id_area_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."area"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_area_user" ON "area" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_area_sibling_name" ON "area" USING btree ("user_id",coalesce("parent_id", '__root__'),"name");
CREATE TABLE IF NOT EXISTS "sandbox_open" (
	"sandbox_id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"opened_at" timestamp NOT NULL,
	"vcpus" integer DEFAULT 2 NOT NULL,
	"label" text DEFAULT 'sandbox' NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sandbox_open" ADD CONSTRAINT "sandbox_open_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sandbox_open_user" ON "sandbox_open" USING btree ("user_id");

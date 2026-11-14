CREATE TABLE "icloud_calendar_account" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"apple_id" text NOT NULL,
	"nickname" text,
	"credential_ciphertext" text NOT NULL,
	"credential_key_id" text DEFAULT 'v1' NOT NULL,
	"calendar_home_url" text,
	"last_verified_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "icloud_calendar_account" ADD CONSTRAINT "icloud_calendar_account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_icloud_calendar_account_user" ON "icloud_calendar_account" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_icloud_calendar_account_user_apple" ON "icloud_calendar_account" USING btree ("user_id","apple_id");
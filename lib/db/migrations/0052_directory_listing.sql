CREATE TABLE "directory_listing" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"category" text NOT NULL,
	"city" text NOT NULL,
	"region" text,
	"country" text DEFAULT 'US' NOT NULL,
	"description" text NOT NULL,
	"website" text,
	"instagram" text,
	"contact_email" text,
	"contact_phone" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"source" text DEFAULT 'self_serve' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX "idx_directory_listing_slug" ON "directory_listing" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_directory_listing_status" ON "directory_listing" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "idx_directory_listing_category" ON "directory_listing" USING btree ("category","status");

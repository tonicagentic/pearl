ALTER TABLE "user" ADD COLUMN "sandbox_browser_timeout_minutes" integer DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "sandbox_browser_vcpus" integer DEFAULT 2 NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "sandbox_coder_timeout_minutes" integer DEFAULT 45 NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "sandbox_coder_vcpus" integer DEFAULT 4 NOT NULL;

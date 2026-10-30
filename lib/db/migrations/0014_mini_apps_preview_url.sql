ALTER TABLE "mini_app" ADD COLUMN "preview_url" text;--> statement-breakpoint
ALTER TABLE "mini_app" ADD COLUMN "preview_port" integer DEFAULT 3000 NOT NULL;
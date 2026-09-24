ALTER TABLE "agent_file" ALTER COLUMN "content" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_file" ADD COLUMN "blob_pathname" text;
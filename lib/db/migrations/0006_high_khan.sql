CREATE TABLE "agent_file_revision" (
	"id" text PRIMARY KEY NOT NULL,
	"chat_id" text NOT NULL,
	"path" text NOT NULL,
	"revision" integer NOT NULL,
	"content" text NOT NULL,
	"byte_length" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_file_revision" ADD CONSTRAINT "agent_file_revision_chat_id_chat_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chat"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_agent_file_revision_chat_path" ON "agent_file_revision" USING btree ("chat_id","path");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_agent_file_revision_version" ON "agent_file_revision" USING btree ("chat_id","path","revision");
CREATE TABLE "agent_attachment" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"media_type" text NOT NULL,
	"byte_length" integer NOT NULL,
	"blob_url" text,
	"pdf_type" text,
	"page_count" integer,
	"pages" jsonb,
	"extraction_note" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_attachment" ADD CONSTRAINT "agent_attachment_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_agent_attachment_user" ON "agent_attachment" USING btree ("user_id");
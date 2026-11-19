CREATE TABLE "connected_agent" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"label" text NOT NULL,
	"url" text NOT NULL,
	"token_ciphertext" text NOT NULL,
	"token_key_id" text DEFAULT 'v1' NOT NULL,
	"last_verified_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat" ADD COLUMN "remote_agent_id" text;--> statement-breakpoint
ALTER TABLE "connected_agent" ADD CONSTRAINT "connected_agent_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat" ADD CONSTRAINT "chat_remote_agent_id_connected_agent_id_fk" FOREIGN KEY ("remote_agent_id") REFERENCES "public"."connected_agent"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_connected_agent_user" ON "connected_agent" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_connected_agent_user_url" ON "connected_agent" USING btree ("user_id","url");--> statement-breakpoint
CREATE INDEX "idx_chat_remote_agent" ON "chat" USING btree ("remote_agent_id");

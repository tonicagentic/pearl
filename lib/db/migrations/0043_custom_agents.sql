CREATE TABLE "custom_agent" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"instructions" text DEFAULT '' NOT NULL,
	"accent" text DEFAULT '#2DD4BF' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat" ADD COLUMN "custom_agent_id" text;--> statement-breakpoint
ALTER TABLE "custom_agent" ADD CONSTRAINT "custom_agent_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat" ADD CONSTRAINT "chat_custom_agent_id_custom_agent_id_fk" FOREIGN KEY ("custom_agent_id") REFERENCES "public"."custom_agent"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_custom_agent_user" ON "custom_agent" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_custom_agent_user_name" ON "custom_agent" USING btree ("user_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_chat_custom_agent" ON "chat" USING btree ("custom_agent_id");

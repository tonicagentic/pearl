CREATE TABLE "device_push_token" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token" text NOT NULL,
	"platform" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_delivery" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"turn_id" text NOT NULL,
	"kind" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "device_push_token" ADD CONSTRAINT "device_push_token_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_device_push_token_user" ON "device_push_token" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_device_push_token_token" ON "device_push_token" USING btree ("token");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_push_delivery_session_turn_kind" ON "push_delivery" USING btree ("session_id","turn_id","kind");--> statement-breakpoint
CREATE INDEX "idx_chat_eve_session_id" ON "chat" USING btree (("eve_session" ->> 'sessionId'));
CREATE TABLE "client_attention" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"surface" text NOT NULL,
	"client_key" text NOT NULL,
	"state" text NOT NULL,
	"chat_id" text,
	"session_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "client_attention" ADD CONSTRAINT "client_attention_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_client_attention_user" ON "client_attention" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_client_attention_user_surface_key" ON "client_attention" USING btree ("user_id","surface","client_key");

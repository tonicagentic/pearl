CREATE TABLE "library_quote" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"text" text NOT NULL,
	"chat_id" text,
	"message_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "library_quote" ADD CONSTRAINT "library_quote_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "library_quote" ADD CONSTRAINT "library_quote_chat_id_chat_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chat"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_library_quote_user" ON "library_quote" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_library_quote_user_created" ON "library_quote" USING btree ("user_id","created_at");

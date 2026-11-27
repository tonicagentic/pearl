CREATE TABLE "plaid_item_index" (
	"item_id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "plaid_item_index" ADD CONSTRAINT "plaid_item_index_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_plaid_item_index_user" ON "plaid_item_index" USING btree ("user_id");

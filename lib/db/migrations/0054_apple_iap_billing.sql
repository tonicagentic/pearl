ALTER TABLE "billing_account" ALTER COLUMN "stripe_customer_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "billing_account" ADD COLUMN "payment_provider" text DEFAULT 'stripe' NOT NULL;--> statement-breakpoint
ALTER TABLE "billing_account" ADD COLUMN "apple_original_transaction_id" text;--> statement-breakpoint
ALTER TABLE "billing_account" ADD COLUMN "apple_product_id" text;--> statement-breakpoint
ALTER TABLE "billing_account" ADD COLUMN "apple_environment" text;--> statement-breakpoint
ALTER TABLE "billing_account" ADD COLUMN "prepaid_credit_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE TABLE "apple_iap_transaction" (
	"transaction_id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"product_id" text NOT NULL,
	"kind" text NOT NULL,
	"credit_cents" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "apple_iap_transaction" ADD CONSTRAINT "apple_iap_transaction_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_apple_iap_transaction_user" ON "apple_iap_transaction" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_billing_account_apple_original" ON "billing_account" USING btree ("apple_original_transaction_id");

CREATE TABLE "billing_account" (
	"user_id" text PRIMARY KEY NOT NULL,
	"stripe_customer_id" text NOT NULL,
	"stripe_subscription_id" text,
	"status" text DEFAULT 'incomplete' NOT NULL,
	"period_start" timestamp,
	"period_end" timestamp,
	"usage_cap_cents" integer DEFAULT 5000 NOT NULL,
	"metronome_customer_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usage_event" (
	"id" text PRIMARY KEY NOT NULL,
	"idempotency_key" text NOT NULL,
	"user_id" text NOT NULL,
	"period_start" timestamp NOT NULL,
	"source" text NOT NULL,
	"cost_cents" integer NOT NULL,
	"billable" boolean DEFAULT true NOT NULL,
	"ingested_at" timestamp,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usage_reservation" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"period_start" timestamp NOT NULL,
	"cents" integer NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
-- Existing users receive a free pass. Add the column defaulting true so every
-- row already present is exempt, then flip the default for new signups.
ALTER TABLE "user" ADD COLUMN "billing_exempt" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "billing_exempt" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "billing_account" ADD CONSTRAINT "billing_account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_event" ADD CONSTRAINT "usage_event_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_reservation" ADD CONSTRAINT "usage_reservation_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_billing_account_stripe_customer" ON "billing_account" USING btree ("stripe_customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_billing_account_stripe_subscription" ON "billing_account" USING btree ("stripe_subscription_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_usage_event_idempotency" ON "usage_event" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "idx_usage_event_user_period" ON "usage_event" USING btree ("user_id","period_start","created_at");--> statement-breakpoint
CREATE INDEX "idx_usage_event_pending_ingest" ON "usage_event" USING btree ("billable","ingested_at");--> statement-breakpoint
CREATE INDEX "idx_usage_reservation_user_period" ON "usage_reservation" USING btree ("user_id","period_start");
-- New default spend cap when Stripe overage is on: $100.
ALTER TABLE "billing_account" ALTER COLUMN "usage_cap_cents" SET DEFAULT 10000;--> statement-breakpoint

-- One-time fixup for rows still on the old $50 default:
-- Apple-only (no Metronome) → $10 included; Stripe/Metronome → $100.
UPDATE "billing_account"
SET "usage_cap_cents" = 1000,
    "updated_at" = now()
WHERE "usage_cap_cents" = 5000
  AND "metronome_customer_id" IS NULL
  AND "payment_provider" = 'apple';--> statement-breakpoint

UPDATE "billing_account"
SET "usage_cap_cents" = 10000,
    "updated_at" = now()
WHERE "usage_cap_cents" = 5000;

ALTER TABLE "usage_event" ADD COLUMN "cost_micros" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- Backfill exact micros from the legacy rounded cents mirror (1¢ = 10_000µ).
UPDATE "usage_event" SET "cost_micros" = "cost_cents" * 10000 WHERE "cost_micros" = 0 AND "cost_cents" <> 0;
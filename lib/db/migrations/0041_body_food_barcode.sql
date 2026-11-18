-- Pearl Body: barcode on foods for scan lookup + unique per user when set.
ALTER TABLE "body"."foods" ADD COLUMN "barcode" text;
--> statement-breakpoint
CREATE UNIQUE INDEX "foods_user_barcode_unique" ON "body"."foods" USING btree ("user_id","barcode") WHERE "barcode" is not null;

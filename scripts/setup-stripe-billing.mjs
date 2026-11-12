#!/usr/bin/env node
/**
 * Create (or reuse) the Pearl $10/month Stripe Product + Price used by Checkout.
 *
 * Usage:
 *   STRIPE_SECRET_KEY=rk_... node scripts/setup-stripe-billing.mjs
 *
 * Prints STRIPE_PRICE_ID. Also prints a reminder to add the webhook endpoint
 * for /api/billing/webhook and to set STRIPE_WEBHOOK_SECRET.
 */
import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY?.trim();
if (!key) {
  console.error("Set STRIPE_SECRET_KEY before running this script.");
  process.exit(1);
}

const stripe = new Stripe(key, { apiVersion: "2026-10-28.endive" });

const PRODUCT_NAME = "Pearl";
const LOOKUP_KEY = "pearl_monthly_10";

async function main() {
  const existing = await stripe.prices.list({
    lookup_keys: [LOOKUP_KEY],
    active: true,
    limit: 1,
  });

  if (existing.data[0]) {
    console.log(`Reusing price ${existing.data[0].id}`);
    console.log(`STRIPE_PRICE_ID=${existing.data[0].id}`);
    return;
  }

  const product = await stripe.products.create({
    name: PRODUCT_NAME,
    description: "Pearl hosted agent — $10/month plus usage",
  });

  const price = await stripe.prices.create({
    product: product.id,
    currency: "usd",
    unit_amount: 1000,
    recurring: { interval: "month" },
    lookup_key: LOOKUP_KEY,
  });

  console.log(`Created product ${product.id}`);
  console.log(`Created price ${price.id}`);
  console.log(`STRIPE_PRICE_ID=${price.id}`);
  console.log("");
  console.log("Next:");
  console.log("1. Add a webhook endpoint to https://<host>/api/billing/webhook");
  console.log(
    "   Events: checkout.session.completed, checkout.session.async_payment_succeeded,",
  );
  console.log(
    "   customer.subscription.created/updated/deleted, invoice.paid, invoice.payment_failed,",
  );
  console.log(
    "   charge.dispute.created, charge.refunded, radar.early_fraud_warning.created",
  );
  console.log("2. Set STRIPE_WEBHOOK_SECRET from that endpoint");
  console.log("3. Create Metronome billable metric pearl_usage (sum cost_cents)");
  console.log("   with group key source, product, rate card, set METRONOME_* env");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

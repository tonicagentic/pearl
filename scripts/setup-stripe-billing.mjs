#!/usr/bin/env node
/**
 * Create (or reuse) the Pearl $29.99/month Stripe Product + Price used by Checkout.
 *
 * Usage:
 *   STRIPE_SECRET_KEY=rk_... node scripts/setup-stripe-billing.mjs
 *
 * Prints STRIPE_PRICE_ID. Also prints a reminder to add the webhook endpoint
 * for /api/billing/webhook and to set STRIPE_WEBHOOK_SECRET.
 *
 * Lookup key: pearl_monthly_2999. Older pearl_monthly_10 prices are left unused.
 */
import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY?.trim();
if (!key) {
  console.error("Set STRIPE_SECRET_KEY before running this script.");
  process.exit(1);
}

const stripe = new Stripe(key, { apiVersion: "2026-10-28.endive" });

const PRODUCT_NAME = "Pearl";
const LOOKUP_KEY = "pearl_monthly_2999";
const UNIT_AMOUNT = 2999;

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

  const products = await stripe.products.search({
    query: `name:"${PRODUCT_NAME}"`,
    limit: 1,
  });
  let productId = products.data[0]?.id;
  if (!productId) {
    const product = await stripe.products.create({
      name: PRODUCT_NAME,
      description:
        "Pearl hosted agent — $29.99/month includes $10 of usage; overage billed via Metronome",
    });
    productId = product.id;
    console.log(`Created product ${product.id}`);
  } else {
    console.log(`Reusing product ${productId}`);
  }

  const price = await stripe.prices.create({
    product: productId,
    currency: "usd",
    unit_amount: UNIT_AMOUNT,
    recurring: { interval: "month" },
    lookup_key: LOOKUP_KEY,
  });

  console.log(`Created price ${price.id}`);
  console.log(`STRIPE_PRICE_ID=${price.id}`);
  console.log("");
  console.log("Next:");
  console.log("1. Set STRIPE_PRICE_ID on Vercel production and preview");
  console.log("2. Add a webhook endpoint to https://<host>/api/billing/webhook");
  console.log(
    "   Events: checkout.session.completed, checkout.session.async_payment_succeeded,",
  );
  console.log(
    "   customer.subscription.created/updated/deleted, invoice.paid, invoice.payment_failed,",
  );
  console.log(
    "   charge.dispute.created, charge.refunded, radar.early_fraud_warning.created",
  );
  console.log("3. Set STRIPE_WEBHOOK_SECRET from that endpoint");
  console.log("4. Create Metronome billable metric pearl_usage (sum cost_cents)");
  console.log("   with group key source, product, rate card, set METRONOME_* env");
  console.log("5. App Store Connect: set pearl_monthly to $29.99");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

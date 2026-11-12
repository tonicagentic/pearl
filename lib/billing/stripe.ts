import Stripe from "stripe";

import { getStripePriceId, isStripeConfigured } from "@/lib/billing/config";
import { getEffectiveAppUrl } from "@/lib/auth-url";

let client: Stripe | null | undefined;

export function getStripe(): Stripe | null {
  if (client !== undefined) {
    return client;
  }

  if (!isStripeConfigured()) {
    client = null;
    return client;
  }

  const key = process.env.STRIPE_SECRET_KEY!.trim();
  client = new Stripe(key, {
    apiVersion: "2026-10-28.endive",
    typescript: true,
  });
  return client;
}

function randomSuffix(length = 8): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)]!;
  }
  return out;
}

/**
 * Create a Checkout Session for the $10/month subscription. The caller must
 * already be a signed-in, non-exempt user. Access unlocks only from webhooks.
 */
export async function createSubscriptionCheckoutSession(input: {
  readonly userId: string;
  readonly email: string;
  readonly stripeCustomerId?: string | null;
  readonly successPath?: string;
  readonly cancelPath?: string;
}): Promise<{ readonly url: string; readonly sessionId: string }> {
  const stripe = getStripe();
  if (!stripe) {
    throw new Error("Stripe is not configured.");
  }

  const origin = getEffectiveAppUrl().replace(/\/$/, "");
  const successPath = input.successPath ?? "/billing/success";
  const cancelPath = input.cancelPath ?? "/billing";

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: input.stripeCustomerId ?? undefined,
    customer_email: input.stripeCustomerId ? undefined : input.email,
    client_reference_id: input.userId,
    line_items: [{ price: getStripePriceId(), quantity: 1 }],
    success_url: `${origin}${successPath}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}${cancelPath}`,
    metadata: { userId: input.userId },
    subscription_data: {
      metadata: { userId: input.userId },
    },
    // Dynamic payment methods — do not pass payment_method_types.
    integration_identifier: `pearl_sub_${randomSuffix()}`,
  });

  if (!session.url) {
    throw new Error("Stripe Checkout Session has no URL.");
  }

  return { url: session.url, sessionId: session.id };
}

export async function createCustomerPortalSession(input: {
  readonly stripeCustomerId: string;
  readonly returnPath?: string;
}): Promise<{ readonly url: string }> {
  const stripe = getStripe();
  if (!stripe) {
    throw new Error("Stripe is not configured.");
  }

  const origin = getEffectiveAppUrl().replace(/\/$/, "");
  const returnPath = input.returnPath ?? "/settings";

  const session = await stripe.billingPortal.sessions.create({
    customer: input.stripeCustomerId,
    return_url: `${origin}${returnPath}`,
  });

  return { url: session.url };
}

export async function retrieveCheckoutSession(
  sessionId: string,
): Promise<Stripe.Checkout.Session> {
  const stripe = getStripe();
  if (!stripe) {
    throw new Error("Stripe is not configured.");
  }

  return stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["subscription", "customer"],
  });
}

export function subscriptionPeriod(
  subscription: Stripe.Subscription,
): { readonly start: Date; readonly end: Date } | null {
  const item = subscription.items.data[0];
  const start = item?.current_period_start ?? subscription.start_date;
  const end = item?.current_period_end;
  if (typeof start !== "number" || typeof end !== "number") {
    return null;
  }
  return { start: new Date(start * 1000), end: new Date(end * 1000) };
}

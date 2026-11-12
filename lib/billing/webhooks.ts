import type Stripe from "stripe";

import {
  findBillingAccountByStripeCustomer,
  findBillingAccountBySubscription,
  getUserBillingFlags,
  upsertBillingAccount,
} from "@/lib/billing/accounts";
import { DEFAULT_USAGE_CAP_CENTS } from "@/lib/billing/config";
import { ensureMetronomeCustomer } from "@/lib/billing/metronome";
import { getStripe, subscriptionPeriod } from "@/lib/billing/stripe";

function customerIdOf(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null,
): string | null {
  if (!customer) return null;
  if (typeof customer === "string") return customer;
  if ("deleted" in customer && customer.deleted) return null;
  return customer.id;
}

function subscriptionIdOf(
  subscription: string | Stripe.Subscription | null | undefined,
): string | null {
  if (!subscription) return null;
  if (typeof subscription === "string") return subscription;
  return subscription.id;
}

async function syncSubscription(
  subscription: Stripe.Subscription,
  userIdHint?: string | null,
): Promise<void> {
  const stripeCustomerId = customerIdOf(subscription.customer);
  if (!stripeCustomerId) {
    return;
  }

  let userId =
    userIdHint ||
    (typeof subscription.metadata?.userId === "string"
      ? subscription.metadata.userId
      : null);

  if (!userId) {
    const existing =
      (await findBillingAccountBySubscription(subscription.id)) ??
      (await findBillingAccountByStripeCustomer(stripeCustomerId));
    userId = existing?.userId ?? null;
  }

  if (!userId) {
    console.error(
      "[billing/webhooks] subscription without userId",
      subscription.id,
    );
    return;
  }

  const flags = await getUserBillingFlags(userId);
  if (!flags) {
    return;
  }
  if (flags.exempt) {
    // Free passes never get a billing account.
    return;
  }

  const period = subscriptionPeriod(subscription);
  const existing = await findBillingAccountByStripeCustomer(stripeCustomerId);
  let metronomeCustomerId = existing?.metronomeCustomerId ?? null;

  if (
    (subscription.status === "active" || subscription.status === "trialing") &&
    !metronomeCustomerId
  ) {
    metronomeCustomerId = await ensureMetronomeCustomer({
      userId,
      email: flags.email,
      name: flags.name,
      stripeCustomerId,
      existingMetronomeCustomerId: metronomeCustomerId,
    });
  }

  await upsertBillingAccount({
    userId,
    stripeCustomerId,
    stripeSubscriptionId: subscription.id,
    status: subscription.status,
    periodStart: period?.start ?? null,
    periodEnd: period?.end ?? null,
    metronomeCustomerId,
    usageCapCents: existing?.usageCapCents ?? DEFAULT_USAGE_CAP_CENTS,
  });
}

async function handleCheckoutSession(
  session: Stripe.Checkout.Session,
): Promise<void> {
  if (session.mode !== "subscription") {
    return;
  }
  if (
    session.payment_status !== "paid" &&
    session.payment_status !== "no_payment_required"
  ) {
    return;
  }

  const userId =
    session.client_reference_id ||
    (typeof session.metadata?.userId === "string"
      ? session.metadata.userId
      : null);
  const stripeCustomerId = customerIdOf(session.customer);
  const stripeSubscriptionId = subscriptionIdOf(session.subscription);

  if (!userId || !stripeCustomerId) {
    return;
  }

  const flags = await getUserBillingFlags(userId);
  if (!flags || flags.exempt) {
    return;
  }

  const stripe = getStripe();
  if (stripe && stripeSubscriptionId) {
    const subscription =
      await stripe.subscriptions.retrieve(stripeSubscriptionId);
    await syncSubscription(subscription, userId);
    return;
  }

  await upsertBillingAccount({
    userId,
    stripeCustomerId,
    stripeSubscriptionId,
    status: "active",
  });
}

async function handleInvoice(invoice: Stripe.Invoice): Promise<void> {
  const stripeCustomerId = customerIdOf(invoice.customer);
  if (!stripeCustomerId) {
    return;
  }

  const account = await findBillingAccountByStripeCustomer(stripeCustomerId);
  if (!account) {
    return;
  }

  // subscription can live under parent for newer Invoice shapes
  const parent = (
    invoice as Stripe.Invoice & {
      parent?: { subscription_details?: { subscription?: string } };
    }
  ).parent;
  const subscriptionId =
    parent?.subscription_details?.subscription ??
    (typeof (invoice as { subscription?: string }).subscription === "string"
      ? (invoice as { subscription?: string }).subscription
      : null);

  if (subscriptionId) {
    const stripe = getStripe();
    if (stripe) {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      await syncSubscription(subscription, account.userId);
      return;
    }
  }

  if (invoice.status === "paid") {
    await upsertBillingAccount({
      userId: account.userId,
      stripeCustomerId,
      stripeSubscriptionId: account.stripeSubscriptionId,
      status: "active",
      periodStart: account.periodStart,
      periodEnd: account.periodEnd,
      metronomeCustomerId: account.metronomeCustomerId,
      usageCapCents: account.usageCapCents,
    });
  }
}

async function markPastDueFromCharge(
  charge: Stripe.Charge,
  status: string,
): Promise<void> {
  const stripeCustomerId = customerIdOf(charge.customer);
  if (!stripeCustomerId) {
    return;
  }
  const account = await findBillingAccountByStripeCustomer(stripeCustomerId);
  if (!account) {
    return;
  }
  await upsertBillingAccount({
    userId: account.userId,
    stripeCustomerId,
    stripeSubscriptionId: account.stripeSubscriptionId,
    status,
    periodStart: account.periodStart,
    periodEnd: account.periodEnd,
    metronomeCustomerId: account.metronomeCustomerId,
    usageCapCents: account.usageCapCents,
  });
}

export async function handleStripeEvent(
  event: Stripe.Event,
): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      await handleCheckoutSession(
        event.data.object as Stripe.Checkout.Session,
      );
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      await syncSubscription(event.data.object as Stripe.Subscription);
      break;
    }
    case "invoice.paid": {
      await handleInvoice(event.data.object as Stripe.Invoice);
      break;
    }
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const stripeCustomerId = customerIdOf(invoice.customer);
      if (!stripeCustomerId) break;
      const account =
        await findBillingAccountByStripeCustomer(stripeCustomerId);
      if (!account) break;
      await upsertBillingAccount({
        userId: account.userId,
        stripeCustomerId,
        stripeSubscriptionId: account.stripeSubscriptionId,
        status: "past_due",
        periodStart: account.periodStart,
        periodEnd: account.periodEnd,
        metronomeCustomerId: account.metronomeCustomerId,
        usageCapCents: account.usageCapCents,
      });
      break;
    }
    case "charge.dispute.created": {
      const dispute = event.data.object as Stripe.Dispute;
      const stripe = getStripe();
      if (!stripe) break;
      const charge = await stripe.charges.retrieve(
        typeof dispute.charge === "string"
          ? dispute.charge
          : dispute.charge.id,
      );
      await markPastDueFromCharge(charge, "disputed");
      break;
    }
    case "charge.refunded": {
      // Refunds do not automatically cancel access; leave status alone unless
      // the subscription itself changes. Log for ops visibility.
      console.info(
        "[billing/webhooks] charge.refunded",
        (event.data.object as Stripe.Charge).id,
      );
      break;
    }
    case "radar.early_fraud_warning.created": {
      const warning = event.data.object as Stripe.Radar.EarlyFraudWarning;
      const stripe = getStripe();
      if (!stripe) break;
      const charge = await stripe.charges.retrieve(
        typeof warning.charge === "string"
          ? warning.charge
          : warning.charge.id,
      );
      await markPastDueFromCharge(charge, "fraud_warning");
      break;
    }
    default:
      break;
  }
}

import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { getStripeWebhookSecret } from "@/lib/billing/config";
import { getStripe } from "@/lib/billing/stripe";
import { handleStripeEvent } from "@/lib/billing/webhooks";

export async function POST(request: Request) {
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      { error: "Stripe is not configured." },
      { status: 503 },
    );
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature." },
      { status: 400 },
    );
  }

  const payload = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      payload,
      signature,
      getStripeWebhookSecret(),
    );
  } catch (error) {
    console.error("[billing/webhook] signature", error);
    return NextResponse.json(
      { error: "Invalid signature." },
      { status: 400 },
    );
  }

  try {
    await handleStripeEvent(event);
  } catch (error) {
    console.error("[billing/webhook] handler", event.type, error);
    return NextResponse.json(
      { error: "Webhook handler failed." },
      { status: 500 },
    );
  }

  return NextResponse.json({ received: true });
}

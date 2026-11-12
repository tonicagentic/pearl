/**
 * Hosted production billing. On when the app runs in database (production)
 * mode and PEARL_BILLING is not explicitly "off". Self-hosters who want
 * production persistence without Pearl invoices set PEARL_BILLING=off.
 */

export const DEFAULT_USAGE_CAP_CENTS = 5000;
export const SUBSCRIPTION_PRICE_CENTS = 1000;

/** Rough reservation for a model turn before real usage lands. */
export const DEFAULT_TURN_RESERVATION_CENTS = 50;

/** Rough reservation for an Exa agent run. */
export const DEFAULT_EXA_RESERVATION_CENTS = 100;

/** Fallback cents per web_search call when Gateway reports no dollar cost. */
export const WEB_SEARCH_FALLBACK_CENTS = 1;

/** Fallback cents per generated image when the provider reports no cost. */
export const IMAGE_FALLBACK_CENTS = 4;

/**
 * Vercel Sandbox pricing: active CPU time. Defaults match published rates
 * ($0.03028 / vCPU-hour ≈ 0.000840 / vCPU-minute). Override with env.
 */
export function sandboxCentsPerVcpuMinute(): number {
  const raw = process.env.PEARL_SANDBOX_CENTS_PER_VCPU_MINUTE?.trim();
  if (raw) {
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed;
    }
  }
  // 0.03028 USD per vCPU-hour → 0.00050467 USD per vCPU-minute → ~0.05 cents
  return 0.050467;
}

export function isBillingExplicitlyOff(): boolean {
  return process.env.PEARL_BILLING?.trim().toLowerCase() === "off";
}

function hasEnv(name: string): boolean {
  return Boolean(process.env[name]?.trim());
}

/** Stripe keys required to create Checkout and verify webhooks. */
export function isStripeConfigured(): boolean {
  return (
    hasEnv("STRIPE_SECRET_KEY") &&
    hasEnv("STRIPE_PRICE_ID") &&
    hasEnv("STRIPE_WEBHOOK_SECRET")
  );
}

/** Metronome token required to invoice usage onto the Stripe customer. */
export function isMetronomeConfigured(): boolean {
  return hasEnv("METRONOME_API_TOKEN");
}

/**
 * Paying users need Stripe. Metronome is required to activate a subscription
 * (usage invoices); without it Checkout can still collect the $10 but usage
 * ingest is skipped until the token is present.
 */
export function isBillingProvidersConfigured(): boolean {
  return isStripeConfigured();
}

export function getStripePriceId(): string {
  return process.env.STRIPE_PRICE_ID!.trim();
}

export function getStripeWebhookSecret(): string {
  return process.env.STRIPE_WEBHOOK_SECRET!.trim();
}

export function getMetronomeApiToken(): string | null {
  const token = process.env.METRONOME_API_TOKEN?.trim();
  return token || null;
}

export function getMetronomeRateCardId(): string | null {
  return process.env.METRONOME_RATE_CARD_ID?.trim() || null;
}

export type BillingBlockReason =
  | "unpaid"
  | "payment_failed"
  | "cap_reached"
  | "billing_misconfigured";

export function blockMessage(reason: BillingBlockReason): string {
  switch (reason) {
    case "unpaid":
      return "Subscribe to Pearl to keep chatting. $10/month plus usage.";
    case "payment_failed":
      return "Your last payment failed. Update your card to keep chatting.";
    case "cap_reached":
      return "You reached your usage spend cap for this period. Raise the cap in Settings to continue.";
    case "billing_misconfigured":
      return "Billing is not configured on this deployment. Try again later.";
  }
}

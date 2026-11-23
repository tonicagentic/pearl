/**
 * Hosted production billing. On when the app runs in database (production)
 * mode and PEARL_BILLING is not explicitly "off". Self-hosters who want
 * production persistence without Pearl invoices set PEARL_BILLING=off.
 *
 * Friend trial: every non-paying, non-exempt account shares a soft spend cap
 * (default $20/month of operator AI cost). PEARL_TRIAL_ALLOWLIST remains for
 * docs / review accounts. Exempt accounts (operator free pass) are uncapped.
 * Anonymous guests get a short free message allowance before sign-up.
 */

export const DEFAULT_USAGE_CAP_CENTS = 5000;
export const DEFAULT_TRIAL_CAP_CENTS = 2000;
export const SUBSCRIPTION_PRICE_CENTS = 1000;
/** Guest (anonymous) users may send this many turns before signup. */
export const GUEST_MESSAGE_LIMIT = 3;

/** Rough reservation for a model turn before real usage lands. */
export const DEFAULT_TURN_RESERVATION_CENTS = 50;

/** Rough reservation for an Exa agent run. */
export const DEFAULT_EXA_RESERVATION_CENTS = 100;

/**
 * Fallback whole-cent mirror for web_search reservations / legacy UI.
 * Exact ledger writes use `exaSearchMicros` ($0.007 Exa auto).
 */
export const WEB_SEARCH_FALLBACK_CENTS = 1;

/**
 * Fallback cents per generated image when the model is unknown and Gateway
 * reports no cost. Matches default `spacexai/grok-imagine-image-2.0` ($0.06).
 */
export const IMAGE_FALLBACK_CENTS = 6;

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

/** Default App Store product id for the $10/month subscription. */
export const DEFAULT_APPLE_IAP_SUBSCRIPTION_ID = "pearl_monthly_10";

/** Default consumable usage credit packs (product id → credit cents). */
export const DEFAULT_APPLE_USAGE_PACKS: Readonly<Record<string, number>> = {
  pearl_usage_10: 1000,
  pearl_usage_25: 2500,
  pearl_usage_50: 5000,
};

/** Auto-renewable subscription product id (App Store Connect). */
export function getAppleIapSubscriptionId(): string {
  return (
    process.env.APPLE_IAP_SUBSCRIPTION_ID?.trim() ||
    DEFAULT_APPLE_IAP_SUBSCRIPTION_ID
  );
}

/**
 * Consumable usage packs. Override with comma-separated `id:cents` pairs, e.g.
 * `pearl_usage_10:1000,pearl_usage_25:2500`.
 */
export function getAppleUsagePackCredits(): Readonly<Record<string, number>> {
  const raw = process.env.APPLE_IAP_USAGE_PRODUCT_IDS?.trim();
  if (!raw) {
    return DEFAULT_APPLE_USAGE_PACKS;
  }
  const packs: Record<string, number> = {};
  for (const entry of raw.split(",")) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    const [idPart, centsPart] = trimmed.includes(":")
      ? trimmed.split(":", 2)
      : [trimmed, undefined];
    const id = idPart?.trim();
    if (!id) continue;
    const fromDefault = DEFAULT_APPLE_USAGE_PACKS[id];
    const cents = centsPart ? Number(centsPart) : fromDefault;
    if (Number.isFinite(cents) && (cents as number) > 0) {
      packs[id] = Math.floor(cents as number);
    } else if (fromDefault) {
      packs[id] = fromDefault;
    }
  }
  return Object.keys(packs).length > 0 ? packs : DEFAULT_APPLE_USAGE_PACKS;
}

export function getAppleIapBundleId(): string {
  return (
    process.env.APPLE_APP_BUNDLE_IDENTIFIER?.trim() ||
    process.env.APPLE_IAP_BUNDLE_ID?.trim() ||
    "com.tonicagentic.pearl"
  );
}

/** Numeric App Store app id (required to verify Production JWS). */
export function getAppleAppAppleId(): number | null {
  const raw =
    process.env.APPLE_APP_APPLE_ID?.trim() ||
    process.env.APPLE_IAP_APP_APPLE_ID?.trim();
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export function isAppleIapConfigured(): boolean {
  return (
    hasEnv("APPLE_IAP_ISSUER_ID") &&
    hasEnv("APPLE_IAP_KEY_ID") &&
    Boolean(process.env.APPLE_IAP_PRIVATE_KEY?.trim())
  );
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
  | "trial_cap_reached"
  | "guest_limit_reached"
  | "billing_misconfigured";

/** Comma-separated allowlist of emails for the friend-beta trial. */
export function getTrialAllowlist(): readonly string[] {
  const raw = process.env.PEARL_TRIAL_ALLOWLIST?.trim();
  if (!raw) {
    return [];
  }
  return raw
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

export function isEmailOnTrialAllowlist(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  return getTrialAllowlist().includes(normalized);
}

/** Soft spend cap for trial users (operator cost). Default $20. */
export function getTrialCapCents(): number {
  const raw = process.env.PEARL_TRIAL_CAP_CENTS?.trim();
  if (raw) {
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return Math.floor(parsed);
    }
  }
  return DEFAULT_TRIAL_CAP_CENTS;
}

export function blockMessage(reason: BillingBlockReason): string {
  switch (reason) {
    case "unpaid":
      return "Subscribe to Pearl to keep chatting. $10/month plus usage.";
    case "payment_failed":
      return "Your last payment failed. Update your card to keep chatting.";
    case "cap_reached":
      return "You reached your usage spend cap for this period. Raise the cap in Settings to continue.";
    case "trial_cap_reached":
      return "You used the included $20 of usage for this month. Access opens again next month.";
    case "guest_limit_reached":
      return "Sign up to continue chatting. Your conversation will stay with your account.";
    case "billing_misconfigured":
      return "Billing is not configured on this deployment. Try again later.";
  }
}
